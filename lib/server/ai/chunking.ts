import type { Audience } from "../../ai/retrieval.ts";

export type ChunkMeta = {
  source: string;
  title: string;
  audience: Audience;
  chunkIndex: number;
  text: string;
};

export type ChunkOptions = {
  source: string;
  title: string;
  audience: Audience;
  maxChunkChars?: number;
};

/**
 * Splits markdown content by headings or paragraph boundaries into manageable chunks.
 */
export function chunkMarkdown(
  markdown: string,
  options: ChunkOptions,
): ChunkMeta[] {
  const maxChars = options.maxChunkChars ?? 1000;
  const sections = markdown.split(/\n(?=#{1,3} )/g);
  const chunks: ChunkMeta[] = [];

  for (const sec of sections) {
    const trimmed = sec.trim();
    if (!trimmed) continue;

    if (trimmed.length <= maxChars) {
      chunks.push({
        source: options.source,
        title: options.title,
        audience: options.audience,
        chunkIndex: chunks.length,
        text: trimmed,
      });
    } else {
      // Split large sections by paragraphs
      const paragraphs = trimmed.split(/\n\s*\n/g);
      let buffer = "";

      for (const p of paragraphs) {
        const cleanP = p.trim();
        if (!cleanP) continue;

        if (buffer.length + cleanP.length + 2 > maxChars && buffer.length > 0) {
          chunks.push({
            source: options.source,
            title: options.title,
            audience: options.audience,
            chunkIndex: chunks.length,
            text: buffer.trim(),
          });
          buffer = cleanP;
        } else {
          buffer = buffer ? `${buffer}\n\n${cleanP}` : cleanP;
        }
      }

      if (buffer.trim()) {
        chunks.push({
          source: options.source,
          title: options.title,
          audience: options.audience,
          chunkIndex: chunks.length,
          text: buffer.trim(),
        });
      }
    }
  }

  // Ensure chunks have contiguous indices
  return chunks.map((c, i) => ({ ...c, chunkIndex: i }));
}

/**
 * Serializes float[] into a binary Float32 buffer for MySQL BLOB storage.
 */
export function serializeEmbedding(floats: readonly number[]): Buffer {
  const buf = Buffer.alloc(floats.length * 4);
  for (let i = 0; i < floats.length; i++) {
    buf.writeFloatLE(floats[i]!, i * 4);
  }
  return buf;
}

/**
 * Deserializes a binary Float32 buffer into float[].
 */
export function deserializeEmbedding(buf: Buffer): number[] {
  const floats: number[] = [];
  const count = Math.floor(buf.length / 4);
  for (let i = 0; i < count; i++) {
    floats.push(buf.readFloatLE(i * 4));
  }
  return floats;
}
