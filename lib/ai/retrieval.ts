import { meetsRole, type Role } from "../roles.ts";

export type Audience = "public" | "viewer" | "member" | "operator" | "admin";

export type ChunkRecord = {
  id: number;
  source: string;
  chunkIndex: number;
  audience: Audience;
  text: string;
  embedding?: number[];
};

export type ScoredChunk = ChunkRecord & {
  score: number;
};

const AUDIENCE_ROLES: Record<Audience, Role | null> = {
  public: null,
  viewer: "viewer",
  member: "member",
  operator: "operator",
  admin: "admin",
};

/**
 * Checks whether an audience tier is visible to the given role.
 */
export function audienceAllowed(
  audience: Audience,
  role: Role | null,
): boolean {
  const req = AUDIENCE_ROLES[audience];
  if (req === null) return true;
  if (!role) return false;
  return meetsRole({ role, userId: "" }, req);
}

/**
 * Filter a list of chunks so that only content accessible to `role` is returned.
 * Used prior to ranking and generation (AI-04).
 */
export function filterChunksByRole<T extends { audience: Audience }>(
  chunks: readonly T[],
  role: Role | null,
): T[] {
  return chunks.filter((c) => audienceAllowed(c.audience, role));
}

/**
 * Computes cosine similarity between two numeric vectors.
 * Returns 0 if either vector has zero magnitude or if lengths mismatch.
 */
export function cosineSimilarity(
  a: readonly number[],
  b: readonly number[],
): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    const valA = a[i]!;
    const valB = b[i]!;
    dot += valA * valB;
    magA += valA * valA;
    magB += valB * valB;
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export type RankOptions = {
  topK?: number;
  minScore?: number;
};

/**
 * Ranks chunks by cosine similarity to a query embedding.
 */
export function rankChunks(
  queryEmbedding: readonly number[],
  chunks: readonly (ChunkRecord & { embedding: number[] })[],
  options: RankOptions = {},
): ScoredChunk[] {
  const topK = options.topK ?? 5;
  const minScore = options.minScore ?? 0.2;

  const scored: ScoredChunk[] = [];
  for (const chunk of chunks) {
    const score = cosineSimilarity(queryEmbedding, chunk.embedding);
    if (score >= minScore) {
      scored.push({ ...chunk, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
