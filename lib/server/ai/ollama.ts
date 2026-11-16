import "server-only";

export type OllamaConfig = {
  baseUrl: string;
  chatModel: string;
  embedModel: string;
};

export function readOllamaConfig(): OllamaConfig | null {
  if (
    !process.env.NEXUS_OLLAMA_HOST &&
    !process.env.NEXUS_OLLAMA_PORT &&
    process.env.NODE_ENV !== "production"
  ) {
    // When environment variables are not explicitly configured in dev/test, return null so tests know it is not configured.
    return null;
  }
  const host = process.env.NEXUS_OLLAMA_HOST || "127.0.0.1";
  const port = process.env.NEXUS_OLLAMA_PORT || "11434";
  return {
    baseUrl: `http://${host}:${port}`,
    chatModel: process.env.NEXUS_OLLAMA_CHAT_MODEL || "gemma3:1b-it-qat",
    embedModel: process.env.NEXUS_OLLAMA_EMBED_MODEL || "nomic-embed-text",
  };
}

export function defaultOllamaConfig(): OllamaConfig {
  const cfg = readOllamaConfig();
  if (cfg) return cfg;
  return {
    baseUrl: "http://127.0.0.1:11434",
    chatModel: "gemma3:1b-it-qat",
    embedModel: "nomic-embed-text",
  };
}

export type OllamaChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

/**
 * Generate embedding for text using Ollama /api/embeddings.
 */
export async function generateEmbedding(
  text: string,
  config = defaultOllamaConfig(),
): Promise<number[]> {
  const res = await fetch(`${config.baseUrl}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.embedModel,
      prompt: text,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new Error(`Embedding request failed with status ${res.status}`);
  }

  const data = (await res.json()) as { embedding: number[] };
  return data.embedding;
}

/**
 * Stream chat completion from Ollama /api/chat.
 */
export async function* streamOllamaChat(
  messages: readonly OllamaChatMessage[],
  options: {
    config?: OllamaConfig;
    signal?: AbortSignal;
  } = {},
): AsyncGenerator<string, void, unknown> {
  const config = options.config || defaultOllamaConfig();

  const res = await fetch(`${config.baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.chatModel,
      messages,
      stream: true,
      options: {
        num_predict: 512,
        temperature: 0.3,
      },
    }),
    signal: options.signal,
  });

  if (!res.ok) {
    throw new Error(`Chat request failed with status ${res.status}`);
  }

  if (!res.body) {
    throw new Error("Chat response body is missing");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const clean = line.trim();
        if (!clean) continue;
        try {
          const parsed = JSON.parse(clean) as {
            message?: { content?: string };
            done?: boolean;
          };
          if (parsed.message?.content) {
            yield parsed.message.content;
          }
        } catch {
          // Skip unparseable line chunks
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
