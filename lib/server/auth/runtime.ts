import "server-only";
import { readDbConfig } from "../db/connection.ts";
import {
  createAuthRuntime,
  readAuthEnv,
  type AuthRuntime,
} from "./create-auth.ts";

// The one Better Auth runtime of this process (live mode only). Created on the
// first request that needs it, so demo mode, builds and tests that never touch
// authentication never read its settings or open a connection (requirement 6.25).
// It uses the application's database user, `nexus_app`.

let instance: AuthRuntime | undefined;

export function getAuthRuntime(): AuthRuntime {
  instance ??= createAuthRuntime({
    db: readDbConfig(),
    env: readAuthEnv(),
    nextCookies: true,
  });
  return instance;
}

/** True when the authentication settings are present, without reading their values into logs. */
export function authIsConfigured(): boolean {
  try {
    readAuthEnv();
    readDbConfig();
    return true;
  } catch {
    return false;
  }
}
