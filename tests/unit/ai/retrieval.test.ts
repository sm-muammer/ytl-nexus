import { describe, expect, it } from "vitest";
import {
  cosineSimilarity,
  rankChunks,
  filterChunksByRole,
} from "@/lib/ai/retrieval";

describe("cosineSimilarity", () => {
  it("calculates exact similarity for identical and orthogonal vectors", () => {
    const a = [1, 0, 0];
    const b = [1, 0, 0];
    const c = [0, 1, 0];
    const d = [-1, 0, 0];

    expect(cosineSimilarity(a, b)).toBeCloseTo(1.0);
    expect(cosineSimilarity(a, c)).toBeCloseTo(0.0);
    expect(cosineSimilarity(a, d)).toBeCloseTo(-1.0);
  });

  it("handles zero vectors gracefully without dividing by zero", () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
    expect(cosineSimilarity([], [])).toBe(0);
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });
});

describe("filterChunksByRole (Audience gating)", () => {
  const chunks = [
    {
      id: 1,
      source: "wp:public-post",
      chunkIndex: 0,
      audience: "public" as const,
      text: "public info",
    },
    {
      id: 2,
      source: "wp:internal-guide",
      chunkIndex: 0,
      audience: "viewer" as const,
      text: "viewer info",
    },
    {
      id: 3,
      source: "runbook:deploy",
      chunkIndex: 0,
      audience: "member" as const,
      text: "member info",
    },
    {
      id: 4,
      source: "runbook:ops",
      chunkIndex: 0,
      audience: "operator" as const,
      text: "operator info",
    },
    {
      id: 5,
      source: "runbook:secrets",
      chunkIndex: 0,
      audience: "admin" as const,
      text: "admin info",
    },
  ];

  it("filters chunks strictly for a Visitor (no role)", () => {
    const visible = filterChunksByRole(chunks, null);
    expect(visible.map((c) => c.audience)).toEqual(["public"]);
  });

  it("filters chunks for Viewer", () => {
    const visible = filterChunksByRole(chunks, "viewer");
    expect(visible.map((c) => c.audience)).toEqual(["public", "viewer"]);
  });

  it("filters chunks for Member", () => {
    const visible = filterChunksByRole(chunks, "member");
    expect(visible.map((c) => c.audience)).toEqual([
      "public",
      "viewer",
      "member",
    ]);
  });

  it("filters chunks for Operator", () => {
    const visible = filterChunksByRole(chunks, "operator");
    expect(visible.map((c) => c.audience)).toEqual([
      "public",
      "viewer",
      "member",
      "operator",
    ]);
  });

  it("allows all audiences for Admin", () => {
    const visible = filterChunksByRole(chunks, "admin");
    expect(visible.map((c) => c.audience)).toEqual([
      "public",
      "viewer",
      "member",
      "operator",
      "admin",
    ]);
  });
});

describe("rankChunks", () => {
  it("ranks chunks by cosine similarity to query embedding descending", () => {
    const queryEmb = [1, 0, 0];
    const candidateChunks = [
      {
        id: 1,
        text: "low",
        embedding: [0.1, 0.9, 0],
        source: "doc1",
        chunkIndex: 0,
        audience: "public" as const,
      },
      {
        id: 2,
        text: "high",
        embedding: [0.95, 0.05, 0],
        source: "doc2",
        chunkIndex: 0,
        audience: "public" as const,
      },
      {
        id: 3,
        text: "medium",
        embedding: [0.7, 0.3, 0],
        source: "doc3",
        chunkIndex: 0,
        audience: "public" as const,
      },
    ];

    const ranked = rankChunks(queryEmb, candidateChunks, {
      topK: 2,
      minScore: 0.5,
    });
    expect(ranked).toHaveLength(2);
    expect(ranked[0]!.id).toBe(2);
    expect(ranked[1]!.id).toBe(3);
    expect(ranked[0]!.score).toBeGreaterThan(ranked[1]!.score);
  });

  it("filters out candidates below minScore", () => {
    const queryEmb = [1, 0, 0];
    const candidateChunks = [
      {
        id: 1,
        text: "negative",
        embedding: [-1, 0, 0],
        source: "doc1",
        chunkIndex: 0,
        audience: "public" as const,
      },
      {
        id: 2,
        text: "zero",
        embedding: [0, 1, 0],
        source: "doc2",
        chunkIndex: 0,
        audience: "public" as const,
      },
    ];
    const ranked = rankChunks(queryEmb, candidateChunks, {
      topK: 5,
      minScore: 0.1,
    });
    expect(ranked).toHaveLength(0);
  });
});
