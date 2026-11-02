// Liveness: the process is up and can answer. Public by design (used by the
// deploy script, systemd checks and Prometheus), so it returns nothing but a
// fixed status word.
export async function GET() {
  return Response.json(
    { status: "live" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
