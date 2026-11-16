import "server-only";
import { sql } from "kysely";
import type { Kysely } from "kysely";
import type { Database } from "@/lib/server/db/schema";

export type StoredChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  sources?: { id: number; title: string; source: string; url?: string }[];
};

export type ConversationRecord = {
  id: number;
  userId: string;
  title: string;
  messages: StoredChatMessage[];
  updatedAt: Date;
};

export async function listConversations(
  db: Kysely<Database>,
  userId: string,
): Promise<{ id: number; title: string; updatedAt: Date }[]> {
  const rows = await db
    .selectFrom("ai_conversations")
    .select(["id", "title", "updated_at"])
    .where("user_id", "=", userId)
    .orderBy("updated_at", "desc")
    .execute();

  return rows.map((r) => ({
    id: Number(r.id),
    title: r.title,
    updatedAt: new Date(r.updated_at),
  }));
}

export async function getConversation(
  db: Kysely<Database>,
  id: number,
  userId: string,
): Promise<ConversationRecord | null> {
  const row = await db
    .selectFrom("ai_conversations")
    .select(["id", "user_id", "title", "messages_json", "updated_at"])
    .where(sql<boolean>`id = ${id}`)
    .where("user_id", "=", userId)
    .executeTakeFirst();

  if (!row) return null;

  let messages: StoredChatMessage[] = [];
  try {
    messages = JSON.parse(row.messages_json);
  } catch {
    messages = [];
  }

  return {
    id: Number(row.id),
    userId: row.user_id,
    title: row.title,
    messages,
    updatedAt: new Date(row.updated_at),
  };
}

export async function saveConversation(
  db: Kysely<Database>,
  params: {
    id?: number;
    userId: string;
    title: string;
    messages: StoredChatMessage[];
  },
): Promise<number> {
  const messagesJson = JSON.stringify(params.messages);

  if (params.id) {
    await db
      .updateTable("ai_conversations")
      .set({
        title: params.title,
        messages_json: messagesJson,
        updated_at: sql`CURRENT_TIMESTAMP(3)`,
      })
      .where(sql<boolean>`id = ${params.id}`)
      .where("user_id", "=", params.userId)
      .execute();
    return params.id;
  }

  const result = await db
    .insertInto("ai_conversations")
    .values({
      user_id: params.userId,
      title: params.title,
      messages_json: messagesJson,
    })
    .executeTakeFirstOrThrow();

  return Number(result.insertId);
}

export async function deleteConversation(
  db: Kysely<Database>,
  id: number,
  userId: string,
): Promise<boolean> {
  const res = await db
    .deleteFrom("ai_conversations")
    .where(sql<boolean>`id = ${id}`)
    .where("user_id", "=", userId)
    .executeTakeFirst();

  return Number(res.numDeletedRows) > 0;
}
