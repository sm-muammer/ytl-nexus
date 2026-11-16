"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LiveDemoLabel } from "@/components/ui/live-demo-label";

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: { id: number; title: string; source: string; url?: string }[];
};

export type ConversationItem = {
  id: number;
  title: string;
  updatedAt: string;
};

export function AiChatView({
  initialExplainPrompt,
  demo = false,
}: {
  initialExplainPrompt?: string;
  demo?: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(initialExplainPrompt || "");
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    number | null
  >(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Load conversations on mount
  useEffect(() => {
    fetch("/api/ai/conversations")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.conversations) {
          setConversations(data.conversations);
        }
      })
      .catch(() => {});
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  };

  const handleDeleteConversation = async (id: number) => {
    try {
      const res = await fetch(`/api/ai/conversations?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (activeConversationId === id) {
          setActiveConversationId(null);
          setMessages([]);
        }
      }
    } catch {}
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const prompt = input.trim();
    if (!prompt || isStreaming) return;

    setErrorMsg(null);
    setInput("");

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: prompt,
    };

    const assistantMsgId = `asst-${Date.now()}`;
    const assistantPlaceholder: Message = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      sources: [],
    };

    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    setIsStreaming(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          conversationId: activeConversationId || undefined,
          history: messages.slice(-4).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        let err = "Failed to connect to Nexus AI";
        try {
          const errData = await res.json();
          if (errData.error === "rate-limited") {
            err =
              "Rate limit reached. Please wait a minute before asking again.";
          } else if (errData.error === "concurrency-limit-exceeded") {
            err =
              "Server is currently busy generating another answer. Please retry in a few seconds.";
          } else if (errData.error === "prompt-too-long") {
            err =
              "Your question is too long. Please shorten it to under 2,000 characters.";
          }
        } catch {}
        setErrorMsg(err);
        setIsStreaming(false);
        setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId));
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const evt of events) {
          const lines = evt.split("\n");
          let eventType = "message";
          let eventData = "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              eventData = line.slice(6);
            }
          }

          if (eventType === "sources") {
            try {
              const sources = JSON.parse(eventData);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId ? { ...m, sources } : m,
                ),
              );
            } catch {}
          } else if (eventType === "delta") {
            try {
              const delta = JSON.parse(eventData);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, content: m.content + delta }
                    : m,
                ),
              );
            } catch {}
          } else if (eventType === "saved") {
            try {
              const { conversationId } = JSON.parse(eventData);
              if (conversationId) {
                setActiveConversationId(conversationId);
              }
            } catch {}
          } else if (eventType === "error") {
            try {
              const { error } = JSON.parse(eventData);
              setErrorMsg(`Error during generation: ${error}`);
            } catch {}
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        setErrorMsg("Connection interrupted or failed.");
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="border-border-strong bg-surface flex h-[720px] flex-col overflow-hidden rounded-xl border md:flex-row">
      {/* Sidebar: Conversation history */}
      <aside className="border-line bg-surface-raised w-full border-b p-4 md:w-64 md:border-r md:border-b-0">
        <div className="border-line flex items-center justify-between border-b pb-3">
          <h2 className="text-muted text-sm font-semibold tracking-wide uppercase">
            Conversations
          </h2>
          <button
            type="button"
            onClick={() => {
              setActiveConversationId(null);
              setMessages([]);
            }}
            className="text-primary text-xs hover:underline"
          >
            New Chat
          </button>
        </div>

        <ul className="mt-3 flex max-h-[160px] flex-col gap-1 overflow-y-auto md:max-h-[620px]">
          {conversations.length === 0 ? (
            <li className="text-muted py-2 text-xs">No saved chats</li>
          ) : (
            conversations.map((c) => (
              <li
                key={c.id}
                className={`group flex items-center justify-between rounded px-2 py-1.5 text-xs ${
                  activeConversationId === c.id
                    ? "bg-surface text-ink font-medium shadow-sm"
                    : "text-muted hover:bg-surface hover:text-ink"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveConversationId(c.id)}
                  className="mr-2 flex-1 truncate text-left"
                >
                  {c.title}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteConversation(c.id)}
                  className="text-muted hover:text-bad-ink opacity-0 group-hover:opacity-100"
                  aria-label={`Delete conversation ${c.title}`}
                >
                  ✕
                </button>
              </li>
            ))
          )}
        </ul>
      </aside>

      {/* Main Chat Area */}
      <main className="bg-surface flex flex-1 flex-col justify-between overflow-hidden">
        {/* Header / Sub-banner */}
        <div className="border-line flex items-center justify-between border-b px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold">Nexus AI Assistant</span>
            <LiveDemoLabel source={demo ? "demo" : "live"} />
          </div>
          <span className="text-muted text-xs">
            Grounded local runbooks & library
          </span>
        </div>

        {/* Message Thread */}
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {messages.length === 0 ? (
            <div className="text-muted flex h-full flex-col items-center justify-center text-center">
              <div className="max-w-md space-y-2">
                <p className="text-ink font-semibold">
                  Nexus Operations & Knowledge AI
                </p>
                <p className="text-sm">
                  Ask questions about deployment procedures, services status,
                  runbooks, or architecture topology. Answers are grounded in
                  platform documentation with citations.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setInput("How do I deploy YTL Nexus?");
                    }}
                    className="border-line bg-surface-raised hover:border-border-strong text-ink rounded-full border px-3 py-1 text-xs"
                  >
                    “How do I deploy YTL Nexus?”
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInput("Explain the Nexus Atlas service topology");
                    }}
                    className="border-line bg-surface-raised hover:border-border-strong text-ink rounded-full border px-3 py-1 text-xs"
                  >
                    “Explain the Nexus Atlas service topology”
                  </button>
                </div>
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${
                  m.role === "user" ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-primary text-primary-contrast"
                      : "bg-surface-raised text-ink border-line border"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>

                  {/* Sources section */}
                  {m.sources && m.sources.length > 0 && (
                    <div className="border-line mt-3 border-t pt-3 text-xs">
                      <p className="text-muted mb-1 font-semibold">
                        Sources & Citations:
                      </p>
                      <ul className="flex flex-wrap gap-2">
                        {m.sources.map((src) => (
                          <li key={src.id}>
                            {src.url ? (
                              <Link
                                href={src.url}
                                className="bg-surface border-line text-primary inline-flex items-center gap-1 rounded border px-2 py-0.5 hover:underline"
                              >
                                📄 {src.title}
                              </Link>
                            ) : (
                              <span className="bg-surface border-line text-muted inline-flex items-center gap-1 rounded border px-2 py-0.5">
                                📖 {src.title}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Error notification */}
        {errorMsg && (
          <div className="border-bad-border bg-bad-surface text-bad-ink mx-6 mb-2 rounded border px-3 py-2 text-xs">
            {errorMsg}
          </div>
        )}

        {/* Input Bar */}
        <form
          onSubmit={handleSubmit}
          className="border-line bg-surface-raised flex items-center gap-3 border-t p-4"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question or request an explanation..."
            className="border-border-strong bg-surface focus:border-primary focus:ring-primary flex-1 rounded-full border px-4 py-2.5 text-sm outline-none focus:ring-1"
            disabled={isStreaming}
            maxLength={2000}
          />

          {isStreaming ? (
            <button
              type="button"
              onClick={handleStop}
              className="bg-bad-ink rounded-full px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="bg-primary text-primary-contrast rounded-full px-5 py-2.5 text-xs font-semibold disabled:opacity-50"
            >
              Send
            </button>
          )}
        </form>
      </main>
    </div>
  );
}
