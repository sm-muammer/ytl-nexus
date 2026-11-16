import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Kysely } from "kysely";
import type { Database } from "../db/schema.ts";
import type { Audience } from "../../ai/retrieval.ts";
import { chunkMarkdown } from "./chunking.ts";
import { deleteChunksBySource, storeChunk } from "./chunks-db.ts";
import { generateEmbedding } from "./ollama.ts";

// Map runbooks or docs to audience roles
const DOCS_AUDIENCE: Record<string, Audience> = {
  "deploy.md": "member",
  "rollback.md": "member",
  "monitoring.md": "member",
  "atlas.md": "member",
  "wordpress.md": "member",
  "sftp.md": "operator",
  "mail.md": "operator",
  "ops-and-status.md": "operator",
  "database.md": "admin",
  "server-baseline.md": "admin",
  "configuration.md": "member",
};

/**
 * Indexes markdown runbooks from docs/operations into ai_chunks.
 */
export async function indexRunbooks(
  db: Kysely<Database>,
  dirPath = join(process.cwd(), "docs/operations"),
): Promise<{ indexed: number; files: number }> {
  let files: string[] = [];
  try {
    files = await readdir(dirPath);
  } catch {
    return { indexed: 0, files: 0 };
  }

  let totalIndexed = 0;
  let fileCount = 0;

  for (const file of files) {
    if (!file.endsWith(".md")) continue;

    const filePath = join(dirPath, file);
    const content = await readFile(filePath, "utf-8");
    const source = `runbook:${file}`;
    const audience = DOCS_AUDIENCE[file] || "member";

    // Clean up existing chunks for this source
    await deleteChunksBySource(db, source);

    const chunks = chunkMarkdown(content, {
      source,
      title: file.replace(/\.md$/, ""),
      audience,
      maxChunkChars: 1200,
    });

    for (const chunk of chunks) {
      const embedding = await generateEmbedding(chunk.text);
      await storeChunk(db, {
        source: chunk.source,
        chunkIndex: chunk.chunkIndex,
        audience: chunk.audience,
        text: chunk.text,
        embedding,
      });
      totalIndexed++;
    }

    fileCount++;
  }

  return { indexed: totalIndexed, files: fileCount };
}

/**
 * Indexes WordPress content item into ai_chunks (called on webhook or sync).
 */
export async function indexWordPressPost(
  db: Kysely<Database>,
  post: {
    slug: string;
    type: string;
    title: string;
    content: string;
    audience?: Audience;
  },
): Promise<number> {
  const source = `wp:${post.type}:${post.slug}`;
  const audience = post.audience || "public";

  await deleteChunksBySource(db, source);

  const chunks = chunkMarkdown(post.content, {
    source,
    title: post.title,
    audience,
    maxChunkChars: 1000,
  });

  for (const chunk of chunks) {
    const embedding = await generateEmbedding(chunk.text);
    await storeChunk(db, {
      source: chunk.source,
      chunkIndex: chunk.chunkIndex,
      audience: chunk.audience,
      text: chunk.text,
      embedding,
    });
  }

  return chunks.length;
}
