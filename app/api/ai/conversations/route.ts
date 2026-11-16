import { NextRequest } from "next/server";
import { getActor } from "@/lib/server/session";
import { meetsRole } from "@/lib/roles";
import { getMode } from "@/lib/server/mode";
import { createDb, readDbConfig } from "@/lib/server/db/connection";
import {
  listConversations,
  deleteConversation,
} from "@/lib/server/ai/conversations-db";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await getActor();
  if (!actor || !meetsRole(actor, "member")) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const isDemo = getMode() === "demo";
  if (isDemo) {
    return Response.json({
      conversations: [
        {
          id: 1,
          title: "Deployment & Rollback Workflow",
          updatedAt: new Date().toISOString(),
        },
        {
          id: 2,
          title: "Nexus Atlas Services Diagnosis",
          updatedAt: new Date(Date.now() - 3600 * 1000).toISOString(),
        },
      ],
    });
  }

  const db = createDb(readDbConfig(), { connectionLimit: 2 });
  try {
    const list = await listConversations(db, actor.userId);
    return Response.json({ conversations: list });
  } finally {
    await db.destroy();
  }
}

export async function DELETE(req: NextRequest) {
  const actor = await getActor();
  if (!actor || !meetsRole(actor, "member")) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const idStr = url.searchParams.get("id");
  if (!idStr) {
    return new Response(JSON.stringify({ error: "missing-id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    return new Response(JSON.stringify({ error: "invalid-id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const isDemo = getMode() === "demo";
  if (isDemo) {
    return Response.json({ ok: true, deleted: id });
  }

  const db = createDb(readDbConfig(), { connectionLimit: 2 });
  try {
    const deleted = await deleteConversation(db, id, actor.userId);
    return Response.json({ ok: deleted, deleted: id });
  } finally {
    await db.destroy();
  }
}
