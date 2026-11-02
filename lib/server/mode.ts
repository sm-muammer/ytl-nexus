import "server-only";

export const NEXUS_MODES = ["live", "demo"] as const;

export type NexusMode = (typeof NEXUS_MODES)[number];

/**
 * Reads NEXUS_MODE. Anything other than exactly "live" or "demo" is refused
 * with a message that names the variable and the accepted values. The rejected
 * value is not echoed, in case it was pasted from somewhere sensitive.
 */
export function readMode(
  env: Record<string, string | undefined> = process.env,
): NexusMode {
  const value = env.NEXUS_MODE;
  if (value === "live" || value === "demo") return value;
  throw new Error(
    'NEXUS_MODE must be set to "live" or "demo". Copy .env.example to .env.local for local work.',
  );
}

/** The mode of this process. Read per call so tests and deployments can change it. */
export function getMode(): NexusMode {
  return readMode(process.env);
}
