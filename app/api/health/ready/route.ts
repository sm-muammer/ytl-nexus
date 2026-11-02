import { checkReadiness } from "@/lib/server/health";

// Readiness: the process and its dependencies can serve traffic. Public by
// design; it reports check names and states only, never error text.
export async function GET() {
  const { ready, checks } = await checkReadiness();
  return Response.json(
    { status: ready ? "ready" : "not-ready", checks },
    { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
