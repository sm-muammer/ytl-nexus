import "server-only";
import { connect as netConnect } from "node:net";
import { connect as tlsConnect } from "node:tls";
import { IMAP_PORT, SUBMISSION_PORT } from "@/lib/mail/types";

// Liveness probes for /mail and the live `mail` adapter. They talk to the mail
// services on loopback only, with fixed ports and a fixed timeout. They read
// the greeting (IMAP) and the capability list (submission) and return booleans:
// no banner, host name or error text leaves this module.
//
// The IMAP probe does not verify the certificate: it connects to 127.0.0.1, a
// name the certificate does not carry, and it only asks "does Dovecot answer
// over TLS". Certificate verification is checked from outside by `verify-mail`.

export const PROBE_TIMEOUT_MS = 3000;
const HOST = "127.0.0.1";

export type MailProbe = {
  /** Dovecot answers on IMAPS (993) with an `* OK` greeting. */
  imap: boolean;
  /** Postfix answers on submission (587), offers STARTTLS and does not offer plaintext AUTH. */
  submission: boolean;
};

/** An IMAP greeting line: `* OK ...` (also `* PREAUTH`/`* BYE` are not healthy). */
export function isImapGreeting(line: string): boolean {
  return /^\* OK\b/i.test(line.trim());
}

/**
 * Reads an SMTP EHLO reply (multi-line `250-...` ending with `250 ...`) and
 * reports whether STARTTLS is offered and whether AUTH is offered before TLS
 * (it must not be: MAIL-03 allows SASL only after STARTTLS).
 */
export function parseEhlo(reply: string): {
  complete: boolean;
  startTls: boolean;
  authBeforeTls: boolean;
} {
  const lines = reply
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const complete = lines.some((l) => /^250 /.test(l));
  const caps = lines.map((l) => l.replace(/^250[- ]/, "").toUpperCase());
  return {
    complete,
    startTls: caps.includes("STARTTLS"),
    authBeforeTls: caps.some((c) => c.startsWith("AUTH ")),
  };
}

function probeImap(): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(ok);
    };
    const socket = tlsConnect({
      host: HOST,
      port: IMAP_PORT,
      rejectUnauthorized: false,
      timeout: PROBE_TIMEOUT_MS,
    });
    socket.setTimeout(PROBE_TIMEOUT_MS, () => finish(false));
    socket.once("error", () => finish(false));
    socket.once("data", (chunk) =>
      finish(isImapGreeting(chunk.toString("utf8"))),
    );
  });
}

function probeSubmission(): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    let buffer = "";
    let sentEhlo = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(ok);
    };
    const socket = netConnect({ host: HOST, port: SUBMISSION_PORT });
    socket.setTimeout(PROBE_TIMEOUT_MS, () => finish(false));
    socket.once("error", () => finish(false));
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      if (!sentEhlo) {
        if (/^220 /m.test(buffer)) {
          sentEhlo = true;
          buffer = "";
          socket.write("EHLO nexus-status\r\n");
        }
        return;
      }
      const ehlo = parseEhlo(buffer);
      if (!ehlo.complete) return;
      socket.write("QUIT\r\n");
      finish(ehlo.startTls && !ehlo.authBeforeTls);
    });
  });
}

export async function probeMail(): Promise<MailProbe> {
  const [imap, submission] = await Promise.all([
    probeImap(),
    probeSubmission(),
  ]);
  return { imap, submission };
}
