import { request } from "node:http";
import { signEnvelope } from "../../lib/ops/protocol.ts";

// Sends one request to the operations agent and prints the status and the body.
// For verification on the server only (infrastructure/scripts/verify-ops):
//
//   NEXUS_OPS_SECRET=... node scripts/ops/send.ts '{"op":"health","check":"web"}'
//
// Options through the environment: NEXUS_OPS_SOCKET, NEXUS_OPS_TS_SHIFT_MS to
// shift the signed timestamp, NEXUS_OPS_NONCE to reuse a nonce, NEXUS_OPS_BAD_SIG=1
// to corrupt the signature, NEXUS_OPS_SECRET_OVERRIDE to sign with another secret.

const secret =
  process.env.NEXUS_OPS_SECRET_OVERRIDE ?? process.env.NEXUS_OPS_SECRET ?? "";
const socketPath = process.env.NEXUS_OPS_SOCKET ?? "/run/nexus-ops/ops.sock";
const raw = process.argv[2];
if (!raw || secret.length < 32) {
  console.error(
    "usage: NEXUS_OPS_SECRET=<secret> node send.ts '<json request>'",
  );
  process.exit(2);
}
const shift = Number(process.env.NEXUS_OPS_TS_SHIFT_MS ?? 0);
const envelope = signEnvelope(
  JSON.parse(raw),
  secret,
  Date.now() + shift,
  process.env.NEXUS_OPS_NONCE,
);
if (process.env.NEXUS_OPS_BAD_SIG === "1") {
  envelope.sig = envelope.sig.replace(
    /^./,
    envelope.sig.startsWith("0") ? "1" : "0",
  );
}
const body = JSON.stringify(envelope);
const req = request(
  {
    socketPath,
    path: "/v1/request",
    method: "POST",
    headers: { "content-length": Buffer.byteLength(body) },
  },
  (res) => {
    let text = "";
    res.on("data", (c: Buffer) => (text += c.toString()));
    res.on("end", () => console.log(`${res.statusCode} ${text}`));
  },
);
req.on("error", (error: NodeJS.ErrnoException) => {
  console.log(`connect-failed ${error.code ?? "error"}`);
  process.exit(1);
});
req.end(body);
