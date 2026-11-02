import { betterAuth } from "better-auth";
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin, twoFactor } from "better-auth/plugins";
import { Kysely, MysqlDialect } from "kysely";
import { createPool } from "mysql2";
import { z } from "zod";
import { ROLES, type Role } from "../../roles.ts";
import { recordAuditEvent } from "../db/audit.ts";
import type { DbConfig } from "../db/connection.ts";
import type { Database } from "../db/schema.ts";
import { ac, roles } from "./access.ts";
import { CLIENT_IP_HEADER, sourceIpFromHeaders } from "./ip.ts";
import {
  LOCKOUT_MESSAGE,
  accountSubject,
  currentLock,
  ipSubject,
  pruneFailures,
  recordFailures,
} from "./lockout.ts";
import { ABSOLUTE_TIMEOUT_MS } from "./rules.ts";

// Builds the Better Auth instance (requirements 6.1, 6.2, 6.12, 6.15 to 6.19).
// No `server-only` import here: the first-admin script and the integration
// tests build it too. The application reaches it through ./runtime.ts.
//
// How the pieces fit:
// - Sessions last 12 hours in the database and are never extended by Better
//   Auth. The 30-minute idle limit is ours (see ./identity.ts), so it also
//   works for page renders, which cannot write cookies.
// - `hooks` run for every entry, the HTTP handler and direct `auth.api` calls,
//   so lockout and audit cannot be skipped by choosing the other door.
// - `nextCookies()` is last so Server Functions can set the session cookie.

const authEnvSchema = z.object({
  secret: z.string().min(32),
  baseURL: z.url(),
  trustedOrigins: z.array(z.url()),
});

export type AuthEnv = z.infer<typeof authEnvSchema>;

/**
 * Reads BETTER_AUTH_SECRET (32 or more characters), BETTER_AUTH_URL (the public
 * address, for example https://ytl-nexus.ytlcomms.my) and the optional
 * NEXUS_TRUSTED_ORIGINS (comma-separated extra addresses people use).
 * The error names the variables and never echoes a value.
 */
export function readAuthEnv(
  env: Record<string, string | undefined> = process.env,
): AuthEnv {
  const extra = (env.NEXUS_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const parsed = authEnvSchema.safeParse({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: extra,
  });
  if (!parsed.success) {
    const names: Record<string, string> = {
      secret: "BETTER_AUTH_SECRET (at least 32 characters)",
      baseURL: "BETTER_AUTH_URL (a full URL)",
      trustedOrigins: "NEXUS_TRUSTED_ORIGINS (comma-separated URLs)",
    };
    const bad = [
      ...new Set(parsed.error.issues.map((i) => names[String(i.path[0])])),
    ];
    throw new Error(
      `Authentication settings are missing or invalid: ${bad.join(", ")}.`,
    );
  }
  return parsed.data;
}

/** Better Auth routes that stay off the HTTP handler. */
export const DISABLED_PATHS = [
  // Accounts are created by an Administrator (CLI now, Control in Task 19).
  "/sign-up/email",
  // No outbound email: resets are done by an Administrator (requirement 6.13).
  "/request-password-reset",
  "/reset-password",
  "/send-verification-email",
  "/verify-email",
  "/change-email",
  "/delete-user",
  "/update-user",
  // Impersonation is off for everyone (requirement 6.12).
  "/admin/impersonate-user",
  "/admin/stop-impersonating",
  // Account administration is reachable only through Nexus Control, which adds
  // Step_Up, input validation and exactly one audit event per action.
  "/admin/set-role",
  "/admin/get-user",
  "/admin/create-user",
  "/admin/update-user",
  "/admin/list-users",
  "/admin/list-user-sessions",
  "/admin/unban-user",
  "/admin/ban-user",
  "/admin/revoke-user-session",
  "/admin/revoke-user-sessions",
  "/admin/remove-user",
  "/admin/set-user-password",
  "/admin/has-permission",
] as const;

export type AuthRuntimeOptions = {
  db: DbConfig;
  env: AuthEnv;
  /** Add `nextCookies()`. Off only where there is no Next.js request, in tests and scripts. */
  nextCookies?: boolean;
  clock?: () => number;
};

function normalise(value: unknown): string {
  return typeof value === "string"
    ? value.trim().toLowerCase().slice(0, 255)
    : "";
}

function isRole(value: unknown): value is Role {
  return ROLES.some((r) => r === value);
}

function pathAction(path: string): string {
  return `auth.${path.replace(/^\//, "").replace(/\//g, ".")}`.slice(0, 100);
}

export function createAuthRuntime(options: AuthRuntimeOptions) {
  const { env } = options;
  const clock = options.clock ?? Date.now;

  const pool = createPool({
    host: options.db.host,
    port: options.db.port,
    database: options.db.database,
    user: options.db.user,
    password: options.db.password,
    connectionLimit: 5,
    connectTimeout: 2000,
    timezone: "Z",
    multipleStatements: false,
  });
  const dialect = new MysqlDialect({ pool });
  const db = new Kysely<Database>({ dialect });

  const secure = env.baseURL.startsWith("https://");

  const audit = (event: Parameters<typeof recordAuditEvent>[1]) =>
    recordAuditEvent(db, event).catch((error: unknown) => {
      // An audit failure must not hide the real outcome, but it must not be silent.
      console.error(
        "audit write failed:",
        error instanceof Error ? error.name : "unknown error",
      );
    });

  const auth = betterAuth({
    appName: "YTL Nexus",
    baseURL: env.baseURL,
    secret: env.secret,
    trustedOrigins: [env.baseURL, ...env.trustedOrigins],
    database: { dialect, type: "mysql" },
    telemetry: { enabled: false },
    logger: { level: "warn" },

    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      autoSignIn: false,
      requireEmailVerification: false,
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },

    session: {
      // Database lifetime: 12 hours from sign-in, never extended (6.16).
      expiresIn: ABSOLUTE_TIMEOUT_MS / 1000,
      disableSessionRefresh: true,
      // Always read the database so a revoked session fails at once (6.17).
      cookieCache: { enabled: false },
      additionalFields: {
        stepUpAt: { type: "date", required: false, input: false },
      },
    },

    advanced: {
      cookiePrefix: "nexus",
      useSecureCookies: secure,
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure,
        path: "/",
      },
      ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
      // Better Auth skips these two checks when NODE_ENV is "test". Say so
      // explicitly, so the tests exercise the same protection as production.
      disableOriginCheck: false,
      disableCSRFCheck: false,
    },

    // A general limiter for the HTTP handler; the sign-in lockout below is the
    // strict rule. It lives in memory, so a restart resets only this layer.
    rateLimit: {
      enabled: true,
      window: 60,
      max: 60,
      storage: "memory",
      customRules: {
        "/sign-in/email": { window: 60, max: 10 },
        "/two-factor/verify-totp": { window: 60, max: 10 },
        "/two-factor/verify-backup-code": { window: 60, max: 10 },
      },
    },

    disabledPaths: [...DISABLED_PATHS],

    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        const headers = ctx.headers ?? ctx.request?.headers;
        const ip = sourceIpFromHeaders(headers);

        if (ctx.path === "/sign-in/email") {
          const email = normalise((ctx.body as { email?: unknown })?.email);
          const until = await currentLock(
            db,
            [accountSubject(email), ipSubject(ip)],
            clock(),
          );
          if (until !== null) {
            await audit({
              actorId: null,
              role: null,
              action: "auth.sign-in",
              target: email || "unknown",
              result: "denied",
              sourceIp: ip,
            });
            throw new APIError("TOO_MANY_REQUESTS", {
              message: LOCKOUT_MESSAGE,
              code: "ACCOUNT_LOCKED",
            });
          }
        }

        if (ctx.path === "/sign-out") {
          // The cookie is gone by the time an after-hook runs, so record who left now.
          const session = await getSessionFromCtx(ctx).catch(() => null);
          await audit({
            actorId: session?.user.id ?? null,
            role: isRole(session?.user.role) ? session.user.role : null,
            action: "auth.sign-out",
            target: session?.user.email ?? "no session",
            result: "success",
            sourceIp: ip,
          });
        }
      }),

      after: createAuthMiddleware(async (ctx) => {
        // Reads are not events. Admin routes are audited by Nexus Control, once per action.
        if (ctx.method === "GET") return;
        if (ctx.path === "/sign-out" || ctx.path.startsWith("/admin/")) return;

        const headers = ctx.headers ?? ctx.request?.headers;
        const ip = sourceIpFromHeaders(headers);
        const failed = ctx.context.returned instanceof APIError;

        const session =
          ctx.context.newSession ??
          (await getSessionFromCtx(ctx).catch(() => null));
        const user = session?.user;
        const email = normalise((ctx.body as { email?: unknown })?.email);

        if (ctx.path === "/sign-in/email" && failed) {
          const now = clock();
          await recordFailures(
            db,
            [accountSubject(email), ipSubject(ip)],
            now,
          ).catch(() => {});
          await pruneFailures(db, now).catch(() => {});
        }

        await audit({
          actorId: user?.id ?? null,
          role: isRole(user?.role) ? user.role : null,
          action: pathAction(ctx.path),
          target: email || user?.email || ctx.path,
          result: failed ? "failure" : "success",
          sourceIp: ip,
        });
      }),
    },

    plugins: [
      admin({
        ac,
        roles,
        defaultRole: "viewer",
        adminRoles: ["admin"],
      }),
      twoFactor({
        issuer: "YTL Nexus",
        totpOptions: { digits: 6, period: 30 },
      }),
      // Must stay last (requirement 6.1).
      ...(options.nextCookies === false ? [] : [nextCookies()]),
    ],
  });

  return {
    auth,
    db,
    env,
    secureCookies: secure,
    audit,
    async destroy() {
      await db.destroy();
    },
  };
}

export type AuthRuntime = ReturnType<typeof createAuthRuntime>;
export type Auth = AuthRuntime["auth"];
