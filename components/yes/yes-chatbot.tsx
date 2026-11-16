"use client";

import { useEffect, useRef, useState } from "react";

type Message = {
  id: string;
  sender: "user" | "bot";
  text: string;
};

export function YesChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "intro",
      sender: "bot",
      text: "Hello! I am your Yes 5G assistant powered by Nexus AI. How can I help you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const prompt = input.trim();
    if (!prompt || loading) return;

    const userMessage: Message = {
      id: "user-" + Date.now(),
      sender: "user",
      text: prompt,
    };

    // Stale-state bug fixed: append user message immediately using functional updater
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    const botMessageId = "bot-" + Date.now();
    let accumulatedText = "";

    try {
      const res = await fetch("/api/ai/chat?scope=yes-public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!res.ok) {
        throw new Error("Chat request failed");
      }

      if (!res.body) {
        throw new Error("No response stream");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // Add placeholder bot message
      setMessages((prev) => [
        ...prev,
        { id: botMessageId, sender: "bot", text: "" },
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const deltaMatch = line.match(/^event: delta\ndata: (.*)$/m);
          if (deltaMatch && deltaMatch[1]) {
            try {
              const delta = JSON.parse(deltaMatch[1]);
              accumulatedText += delta;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === botMessageId
                    ? { ...msg, text: accumulatedText }
                    : msg,
                ),
              );
            } catch {
              // ignore parse errors
            }
          }
        }
      }

      if (!accumulatedText.trim()) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === botMessageId
              ? {
                  ...msg,
                  text: "Thank you for asking! Yes 5G delivers Malaysia's fastest 5G network coverage powered by DNB.",
                }
              : msg,
          ),
        );
      }
    } catch {
      // Keep user message intact, append helpful error/fallback
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== botMessageId),
        {
          id: "bot-err-" + Date.now(),
          sender: "bot",
          text: "Sorry, I am temporarily unable to connect to the knowledge service. Please visit yes.my/support or try again shortly.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed right-4 bottom-4 z-50">
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-expanded={false}
          aria-label="Open Yes 5G assistant chat"
          className="focus-ring bg-yes-pink text-surface flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95"
        >
          <svg
            aria-hidden="true"
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
        </button>
      ) : (
        <div
          role="dialog"
          aria-label="Yes 5G Assistant Chatbot"
          className="border-line bg-surface flex h-[480px] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border shadow-2xl transition-all"
        >
          {/* Header */}
          <div className="border-line bg-surface-elevated flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="bg-yes-pink h-2.5 w-2.5 animate-pulse rounded-full" />
              <div>
                <h3 className="text-ink text-sm font-semibold">
                  Yes 5G Assistant
                </h3>
                <p className="text-muted text-xs">Nexus AI · yes-public</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close chatbot window"
              className="text-muted hover:text-ink focus-ring rounded-md p-1.5 transition-colors"
            >
              <svg
                aria-hidden="true"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Messages body */}
          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto p-4 text-sm"
          >
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 leading-relaxed ${
                    m.sender === "user"
                      ? "bg-yes-pink text-surface"
                      : "bg-surface-elevated text-ink border-line border"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-surface-elevated text-muted border-line flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-xs">
                  <span className="bg-yes-pink h-1.5 w-1.5 animate-bounce rounded-full" />
                  <span className="bg-yes-pink h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:150ms]" />
                  <span className="bg-yes-pink h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:300ms]" />
                  <span className="ml-1">Thinking...</span>
                </div>
              </div>
            )}
          </div>

          {/* Input form */}
          <form
            onSubmit={handleSubmit}
            className="border-line bg-surface-elevated/40 border-t p-3"
          >
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about 5G plans, coverage..."
                className="border-line bg-surface text-ink placeholder:text-muted focus-ring flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                aria-label="Send message"
                className="focus-ring bg-yes-pink text-surface inline-flex h-9 w-9 items-center justify-center rounded-lg shadow-xs transition-transform active:scale-95 disabled:opacity-50"
              >
                <svg
                  aria-hidden="true"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                  />
                </svg>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
