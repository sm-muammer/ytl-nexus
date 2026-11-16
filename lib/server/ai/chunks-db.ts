import "server-only";
import { sql } from "kysely";
import type { Kysely } from "kysely";
import type { Database } from "@/lib/server/db/schema";
import type { Audience, ScoredChunk } from "@/lib/ai/retrieval";
import { filterChunksByRole, rankChunks } from "@/lib/ai/retrieval";
import type { Role } from "@/lib/roles";
import { deserializeEmbedding, serializeEmbedding } from "./chunking";
import { generateEmbedding } from "./ollama";

export type StoredAiChunk = {
  id: number;
  source: string;
  chunk_index: number;
  audience: Audience;
  text: string;
  embedding: Buffer;
};

/**
 * Stores or updates a chunk and its embedding in ai_chunks table.
 */
export async function storeChunk(
  db: Kysely<Database>,
  chunk: {
    source: string;
    chunkIndex: number;
    audience: Audience;
    text: string;
    embedding: readonly number[];
  },
): Promise<void> {
  const blob = serializeEmbedding(chunk.embedding);
  await sql`
    INSERT INTO ai_chunks (source, chunk_index, audience, text, embedding)
    VALUES (${chunk.source}, ${chunk.chunkIndex}, ${chunk.audience}, ${chunk.text}, ${blob})
    ON DUPLICATE KEY UPDATE
      audience = VALUES(audience),
      text = VALUES(text),
      embedding = VALUES(embedding)
  `.execute(db);
}

/**
 * Deletes all chunks matching a source prefix (e.g. when updating a runbook or post).
 */
export async function deleteChunksBySource(
  db: Kysely<Database>,
  source: string,
): Promise<void> {
  await db.deleteFrom("ai_chunks").where("source", "=", source).execute();
}

/**
 * Retrieves and ranks relevant chunks for a user query, strictly enforcing role audience boundaries.
 */
export async function searchChunks(
  db: Kysely<Database>,
  query: string,
  role: Role | null,
  options: { topK?: number; minScore?: number } = {},
): Promise<ScoredChunk[]> {
  // 1. Fetch chunks accessible to the role
  const rows = await db
    .selectFrom("ai_chunks")
    .select(["id", "source", "chunk_index", "audience", "text", "embedding"])
    .execute();

  // 2. Strict audience filter before ranking
  const filtered = filterChunksByRole(
    rows.map((r) => ({
      id: Number(r.id),
      source: r.source,
      chunkIndex: r.chunk_index,
      audience: r.audience as Audience,
      text: r.text,
      embedding: deserializeEmbedding(r.embedding as Buffer),
    })),
    role,
  );

  if (filtered.length === 0) {
    return [];
  }

  // 3. Generate query embedding
  const queryEmbedding = await generateEmbedding(query);

  // 4. Rank via cosine similarity
  return rankChunks(queryEmbedding, filtered, options);
}
