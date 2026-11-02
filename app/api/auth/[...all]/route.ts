import { toNextJsHandler } from "better-auth/next-js";
import { getAuthRuntime } from "@/lib/server/auth/runtime";
import { getMode } from "@/lib/server/mode";

// Better Auth's HTTP interface. It applies the sign-in lockout, the rate limits
// and the audit hooks, and the routes that change accounts or send email are
// switched off (DISABLED_PATHS in lib/server/auth/create-auth.ts). The pages use
// Server Functions instead and never call this route themselves.
//
// Demo_Mode has no auth database (requirement 6.25), so it answers 404.

export const dynamic = "force-dynamic";

const notFound = () => new Response(null, { status: 404 });

function handler(method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE") {
  return async (request: Request): Promise<Response> => {
    if (getMode() === "demo") return notFound();
    return toNextJsHandler(getAuthRuntime().auth)[method](request);
  };
}

export const GET = handler("GET");
export const POST = handler("POST");
export const PATCH = handler("PATCH");
export const PUT = handler("PUT");
export const DELETE = handler("DELETE");
