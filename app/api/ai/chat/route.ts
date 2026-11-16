import { NextRequest } from "next/server";
import { getActor } from "@/lib/server/session";
import { meetsRole } from "@/lib/roles";
import { getMode } from "@/lib/server/mode";
import { checkAiLimits, acquireSlot, releaseSlot } from "@/lib/ai/limits";
import { buildSystemPrompt, type RetrievedContext } from "@/lib/ai/prompts";
import {
  DEMO_AI_KNOWLEDGE_BASE,
  DEMO_AI_DEFAULT_RESPONSE,
} from "@/lib/fixtures/ai";
import { readOllamaConfig, streamOllamaChat } from "@/lib/server/ai/ollama";
import { createDb, readDbConfig } from "@/lib/server/db/connection";
import { searchChunks } from "@/lib/server/ai/chunks-db";
import {
  saveConversation,
  getConversation,
  type StoredChatMessage,
} from "@/lib/server/ai/conversations-db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const actor = await getActor();
  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") || "default";

  // Public scope for Yes Experience (AI-08)
  if (scope === "yes-public") {
    // Accessible without auth, but restricted to public Yes content
  } else {
    // /ai endpoint: Members and above (AI-04, spec 18)
    if (!actor || !meetsRole(actor, "member")) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // Parse body
  let body: {
    prompt: string;
    conversationId?: number;
    history?: { role: "user" | "assistant"; content: string }[];
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid-json" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!body.prompt || typeof body.prompt !== "string") {
    return new Response(JSON.stringify({ error: "missing-prompt" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

  // Check rate limits & max prompt size (AI-07)
  const limitCheck = checkAiLimits({ prompt: body.prompt, ip: clientIp });
  if (!limitCheck.ok) {
    return new Response(JSON.stringify({ error: limitCheck.error }), {
      status: limitCheck.error === "rate-limited" ? 429 : 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Demo mode (DEMO-01)
  const isDemo = getMode() === "demo";
  if (isDemo) {
    const qLower = body.prompt.toLowerCase();
    const matched = DEMO_AI_KNOWLEDGE_BASE.find((k) =>
      k.matchKeywords.some((kw) => qLower.includes(kw.toLowerCase())),
    );
    const chosen = matched || DEMO_AI_DEFAULT_RESPONSE;

    // Stream SSE response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        // Send sources event first
        controller.enqueue(
          encoder.encode(
            `event: sources\ndata: ${JSON.stringify(chosen.sources)}\n\n`,
          ),
        );

        // Stream reply tokens
        const words = chosen.response.split(" ");
        for (let i = 0; i < words.length; i++) {
          const chunk = (i === 0 ? "" : " ") + words[i];
          controller.enqueue(
            encoder.encode(`event: delta\ndata: ${JSON.stringify(chunk)}\n\n`),
          );
          await new Promise((r) => setTimeout(r, 20));
        }

        controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }

  // Live Mode: Global concurrency cap (AI-07)
  if (!acquireSlot()) {
    return new Response(
      JSON.stringify({ error: "concurrency-limit-exceeded" }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const ollamaConfig = readOllamaConfig();
  if (!ollamaConfig) {
    releaseSlot();
    return new Response(JSON.stringify({ error: "ollama-unconfigured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const role = scope === "yes-public" ? null : (actor?.role ?? null);
  const db = createDb(readDbConfig(), { connectionLimit: 2 });

  // Retrieval search
  let retrievedContexts: RetrievedContext[] = [];
  try {
    const rankedChunks = await searchChunks(db, body.prompt, role, {
      topK: 3,
      minScore: 0.35,
    });
    retrievedContexts = rankedChunks.map((c) => ({
      id: c.id,
      source: c.source,
      title: c.source.replace(/^(runbook|wp:[^:]+):/, ""),
      text: c.text,
      url: c.source.startsWith("wp:")
        ? `/library/${c.source.split(":")[2]}`
        : undefined,
    }));
  } catch {
    // If embedding search fails (e.g. model offline), proceed without RAG
    retrievedContexts = [];
  }

  const systemPrompt = buildSystemPrompt(retrievedContexts);
  const messages: { role: "system" | "user" | "assistant"; content: string }[] =
    [{ role: "system", content: systemPrompt }];

  if (body.history && Array.isArray(body.history)) {
    for (const h of body.history.slice(-6)) {
      if (h.role === "user" || h.role === "assistant") {
        messages.push({ role: h.role, content: h.content });
      }
    }
  }

  messages.push({ role: "user", content: body.prompt });

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let fullAssistantReply = "";

      try {
        // Send sources event
        controller.enqueue(
          encoder.encode(
            `event: sources\ndata: ${JSON.stringify(retrievedContexts)}\n\n`,
          ),
        );

        for await (const delta of streamOllamaChat(messages, {
          config: ollamaConfig,
          signal: req.signal,
        })) {
          fullAssistantReply += delta;
          controller.enqueue(
            encoder.encode(`event: delta\ndata: ${JSON.stringify(delta)}\n\n`),
          );
        }

        // Save conversation if authenticated user
        if (actor?.userId) {
          try {
            const existing = body.conversationId
              ? await getConversation(db, body.conversationId, actor.userId)
              : null;

            const updatedMessages: StoredChatMessage[] = existing
              ? existing.messages
              : [];

            updatedMessages.push({
              role: "user",
              content: body.prompt,
              timestamp: Date.now(),
            });
            updatedMessages.push({
              role: "assistant",
              content: fullAssistantReply,
              timestamp: Date.now(),
              sources: retrievedContexts,
            });

            const savedId = await saveConversation(db, {
              id: body.conversationId,
              userId: actor.userId,
              title:
                existing?.title ||
                body.prompt.slice(0, 40) + (body.prompt.length > 40 ? "…" : ""),
              messages: updatedMessages,
            });

            controller.enqueue(
              encoder.encode(
                `event: saved\ndata: ${JSON.stringify({ conversationId: savedId })}\n\n`,
              ),
            );
          } catch {
            // Non-critical if history save fails
          }
        }

        controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
      } catch (err: unknown) {
        if (req.signal.aborted) {
          controller.enqueue(
            encoder.encode(`event: aborted\ndata: {"aborted":true}\n\n`),
          );
        } else {
          const message =
            err instanceof Error ? err.message : "inference-failed";
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({ error: message })}\n\n`,
            ),
          );
        }
      } finally {
        releaseSlot();
        await db.destroy().catch(() => {});
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
