import { describe, expect, it, vi } from "vitest";
import { POST as chatRoute } from "@/app/api/ai/chat/route";
import {
  GET as getConversations,
  DELETE as deleteConversations,
} from "@/app/api/ai/conversations/route";
import { NextRequest } from "next/server";

// Mock auth session
vi.mock("@/lib/server/session", () => ({
  getActor: vi.fn(),
}));

// Mock mode as demo
vi.mock("@/lib/server/mode", () => ({
  getMode: vi.fn(() => "demo"),
}));

import { getActor } from "@/lib/server/session";

describe("AI Chat Route (app/api/ai/chat/route.ts)", () => {
  it("rejects unauthorized access for non-member roles", async () => {
    vi.mocked(getActor).mockResolvedValueOnce(null); // Visitor
    const req = new NextRequest("http://localhost:3000/api/ai/chat", {
      method: "POST",
      body: JSON.stringify({ prompt: "Hello" }),
    });

    const res = await chatRoute(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("forbidden");
  });

  it("permits member and streams SSE responses with citations in demo mode", async () => {
    vi.mocked(getActor).mockResolvedValueOnce({ userId: "u1", role: "member" });
    const req = new NextRequest("http://localhost:3000/api/ai/chat", {
      method: "POST",
      body: JSON.stringify({ prompt: "How do I deploy YTL Nexus?" }),
    });

    const res = await chatRoute(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");

    const reader = res.body?.getReader();
    expect(reader).toBeDefined();

    const decoder = new TextDecoder();
    let text = "";
    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;
      text += decoder.decode(value);
    }

    expect(text).toContain("event: sources");
    expect(text).toContain("runbook:deploy.md");
    expect(text).toContain("event: delta");
    expect(text).toContain("event: done");
  });

  it("permits yes-public scope without authentication", async () => {
    vi.mocked(getActor).mockResolvedValueOnce(null); // Unauthenticated public
    const req = new NextRequest(
      "http://localhost:3000/api/ai/chat?scope=yes-public",
      {
        method: "POST",
        body: JSON.stringify({ prompt: "Tell me about Yes 5G" }),
      },
    );

    const res = await chatRoute(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");
  });
});

describe("AI Conversations Route (app/api/ai/conversations/route.ts)", () => {
  it("returns conversations list for Member in demo mode", async () => {
    vi.mocked(getActor).mockResolvedValueOnce({ userId: "u1", role: "member" });
    const res = await getConversations();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.conversations).toHaveLength(2);
    expect(body.conversations[0].title).toBe("Deployment & Rollback Workflow");
  });

  it("deletes a conversation", async () => {
    vi.mocked(getActor).mockResolvedValueOnce({ userId: "u1", role: "member" });
    const req = new NextRequest(
      "http://localhost:3000/api/ai/conversations?id=1",
      {
        method: "DELETE",
      },
    );

    const res = await deleteConversations(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.deleted).toBe(1);
  });
});
