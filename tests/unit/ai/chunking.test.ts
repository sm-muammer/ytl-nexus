import { describe, expect, it } from "vitest";
import {
  chunkMarkdown,
  serializeEmbedding,
  deserializeEmbedding,
} from "@/lib/server/ai/chunking";

describe("chunkMarkdown", () => {
  it("splits markdown content into bounded sections with metadata", () => {
    const markdown = `
# Deployment Runbook

This is the overview of deployment.

## Prerequisites

Ensure all tests pass and credentials exist.

## Procedure

1. Run preflight
2. Execute deploy script
`;

    const chunks = chunkMarkdown(markdown, {
      source: "docs/operations/deploy.md",
      title: "Deployment Runbook",
      audience: "member",
      maxChunkChars: 150,
    });

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0]!.source).toBe("docs/operations/deploy.md");
    expect(chunks[0]!.audience).toBe("member");
    expect(chunks[0]!.chunkIndex).toBe(0);
    expect(chunks[0]!.text).toContain("Deployment Runbook");
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(250);
    }
  });
});

describe("Embedding Serialization", () => {
  it("converts float array to and from binary buffer without precision loss", () => {
    const original = [0.123456, -0.654321, 0.987654, 0.0, -1.0, 1.0];
    const buffer = serializeEmbedding(original);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBe(original.length * 4); // 4 bytes per Float32

    const restored = deserializeEmbedding(buffer);
    expect(restored).toHaveLength(original.length);
    for (let i = 0; i < original.length; i++) {
      expect(restored[i]).toBeCloseTo(original[i]!, 5);
    }
  });
});
