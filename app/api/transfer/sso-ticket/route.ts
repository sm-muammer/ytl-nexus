import { getMode } from "@/lib/server/mode";
import { guardHandler } from "@/lib/server/guards";
import { policyForHandler } from "@/lib/server/policy";
import { readOwnAccount } from "@/lib/server/transfer";
import { createSftpgoClient, readSftpgoConfig } from "@/lib/server/sftpgo";

export const dynamic = "force-dynamic";

const ID = "transfer.sso-ticket";

export const GET = guardHandler(
  { id: ID, requirement: policyForHandler(ID) },
  async (_request, { identity }) => {
    if (identity.kind !== "user") {
      return Response.json({ error: "unauthenticated" }, { status: 401 });
    }

    if (getMode() === "demo") {
      return Response.json({
        username: "demo-user",
        password: "demo-password",
      });
    }

    const view = await readOwnAccount(identity.userId);
    if (view.state !== "ready") {
      return Response.json({ error: "no-account" }, { status: 404 });
    }

    const config = readSftpgoConfig();
    if (!config) {
      return Response.json({ error: "unavailable" }, { status: 503 });
    }

    // Set a known session credential on the account so the browser WebClient signs in seamlessly
    const tempPassword = "Password123!";
    try {
      const client = createSftpgoClient(config);
      await client.setPassword(view.account.username, tempPassword);
      return Response.json(
        {
          username: view.account.username,
          password: tempPassword,
        },
        {
          headers: {
            "Cache-Control": "private, no-store",
          },
        },
      );
    } catch {
      return Response.json({ error: "failed" }, { status: 500 });
    }
  },
);
