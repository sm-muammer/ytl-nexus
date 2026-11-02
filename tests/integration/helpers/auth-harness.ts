import { randomBytes } from "node:crypto";
import type { Role } from "@/lib/roles";
import {
  createAuthRuntime,
  type AuthRuntime,
} from "@/lib/server/auth/create-auth";
import {
  confirmEnrolment,
  createAccount,
  startEnrolment,
} from "@/lib/server/auth/service";
import { totpCode } from "../../helpers/totp";
import { createScratchDatabase, type ScratchDatabase } from "./test-db";

export const BASE_URL = "https://nexus.test";

export type Harness = {
  scratch: ScratchDatabase;
  rt: AuthRuntime;
  /** Moves the clock the lockout uses. */
  clock: { now: number };
  close(): Promise<void>;
};

/** A scratch database, migrated and granted, with Better Auth running as `nexus_app`. */
export async function createHarness(): Promise<Harness> {
  const scratch = await createScratchDatabase();
  await scratch.prepare();
  const clock = { now: Date.now() };
  const rt = createAuthRuntime({
    db: scratch.config("app"),
    env: {
      secret: randomBytes(32).toString("hex"),
      baseURL: BASE_URL,
      trustedOrigins: ["https://alias.nexus.test"],
    },
    nextCookies: false,
    clock: () => clock.now,
  });
  return {
    scratch,
    rt,
    clock,
    async close() {
      await rt.destroy();
      await scratch.drop();
    },
  };
}

export const PASSWORD = "correct horse battery staple";

let counter = 0;

/** Creates an account straight in the database (what the first-admin script does). */
export async function makeUser(
  h: Harness,
  role: Role,
  name = `${role}-${++counter}`,
): Promise<{ id: string; email: string; password: string }> {
  const email = `${name}@example.com`;
  const { id } = await createAccount(h.rt, {
    email,
    name,
    role,
    password: PASSWORD,
  });
  return { id, email, password: PASSWORD };
}

/** A cookie jar built from Set-Cookie headers, enough for these tests. */
export class Jar {
  private cookies = new Map<string, string>();
  constructor(readonly ip = "10.0.0.5") {}

  absorb(headers: Headers): void {
    for (const line of headers.getSetCookie()) {
      const [pair] = line.split(";");
      const eq = (pair ?? "").indexOf("=");
      if (eq < 0) continue;
      const name = (pair as string).slice(0, eq);
      const value = (pair as string).slice(eq + 1);
      if (value === "" || /max-age=0/i.test(line)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  names(): string[] {
    return [...this.cookies.keys()];
  }

  headers(extra: Record<string, string> = {}): Headers {
    const h = new Headers({
      origin: BASE_URL,
      "x-real-ip": this.ip,
      ...extra,
    });
    if (this.cookies.size > 0) {
      h.set(
        "cookie",
        [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "),
      );
    }
    return h;
  }
}

export type SignIn =
  | { kind: "session"; headers: Headers }
  | { kind: "two-factor" }
  | { kind: "failed"; status: number; message: string };

/** Signs in with email and password. Cookies from the response go into `jar`. */
export async function signIn(
  h: Harness,
  jar: Jar,
  email: string,
  password: string,
): Promise<SignIn> {
  try {
    const { headers, response } = await h.rt.auth.api.signInEmail({
      body: { email, password },
      headers: jar.headers(),
      returnHeaders: true,
    });
    jar.absorb(headers);
    if ("twoFactorRedirect" in response && response.twoFactorRedirect) {
      return { kind: "two-factor" };
    }
    return { kind: "session", headers: jar.headers() };
  } catch (error) {
    const e = error as {
      statusCode?: number;
      status?: number | string;
      message?: string;
    };
    return {
      kind: "failed",
      status: e.statusCode ?? 0,
      message: e.message ?? "",
    };
  }
}

/** Completes the second step of a sign-in with a TOTP code. */
export async function verifyTotp(h: Harness, jar: Jar, code: string) {
  const { headers } = await h.rt.auth.api.verifyTOTP({
    body: { code },
    headers: jar.headers(),
    returnHeaders: true,
  });
  jar.absorb(headers);
  return jar.headers();
}

/**
 * Gives a user working two-factor and returns the secret an authenticator app
 * would hold. The user signs in once without it (as a new Operator would), enrols,
 * and the caller then signs in again with `signInWithTotp`.
 */
export async function enrolTotp(
  h: Harness,
  user: { email: string; password: string },
): Promise<string> {
  const jar = new Jar();
  const first = await signIn(h, jar, user.email, user.password);
  if (first.kind !== "session") throw new Error("setup sign-in failed");
  // Real time, not the harness clock: sessions and TOTP codes use the real clock.
  const start = await startEnrolment(h.rt, first.headers, user.password);
  if (!start.ok) throw new Error(`enrolment start failed: ${start.reason}`);
  const done = await confirmEnrolment(
    h.rt,
    first.headers,
    totpCode(start.manualKey),
  );
  if (!done.ok) throw new Error(`enrolment confirm failed: ${done.reason}`);
  return start.manualKey;
}

/** Password then TOTP, returning request headers that carry the new session. */
export async function signInWithTotp(
  h: Harness,
  user: { email: string; password: string },
  secret: string,
  jar = new Jar(),
): Promise<Headers> {
  const first = await signIn(h, jar, user.email, user.password);
  if (first.kind !== "two-factor")
    throw new Error("expected a two-factor challenge");
  return verifyTotp(h, jar, totpCode(secret));
}

export async function auditRows(h: Harness, action?: string) {
  let q = h.scratch.app.selectFrom("audit_events").selectAll().orderBy("id");
  if (action) q = q.where("action", "=", action);
  return q.execute();
}
