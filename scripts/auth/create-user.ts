import os from "node:os";
import { readDbConfig } from "../../lib/server/db/connection.ts";
import { parseCreateUserArgs } from "../../lib/server/auth/cli-args.ts";
import {
  createAuthRuntime,
  readAuthEnv,
} from "../../lib/server/auth/create-auth.ts";
import {
  createAccount,
  generatePassword,
} from "../../lib/server/auth/service.ts";

// The first-admin script (requirement 6.14, IAM-08). Run it on Nexus Core 01 as
// the `nexus` user with the web environment loaded; see docs/security/auth.md.
// It needs no session because whoever can run it already controls the server.
// It writes one audit event, with the Unix user as the actor.

async function readPasswordFromStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8").split(/\r?\n/)[0] ?? "";
}

async function main(): Promise<number> {
  const args = parseCreateUserArgs(process.argv.slice(2));
  const rt = createAuthRuntime({
    db: readDbConfig(),
    env: readAuthEnv(),
    nextCookies: false,
  });
  const actor = `cli:${os.userInfo().username}`.slice(0, 64);
  const generated = !args.passwordFromStdin;
  const password = generated
    ? generatePassword()
    : await readPasswordFromStdin();

  try {
    await createAccount(rt, {
      email: args.email,
      name: args.name,
      role: args.role,
      password,
    });
    await rt.audit({
      actorId: actor,
      role: null,
      action: "admin.create-user",
      target: `${args.email} (${args.role})`,
      result: "success",
      sourceIp: "127.0.0.1",
    });
    console.log(`Created ${args.role} account for ${args.email}.`);
    if (generated) {
      console.log(`Password (shown once, pass it on privately): ${password}`);
    }
    if (args.role === "operator" || args.role === "admin") {
      console.log("Two-factor sign-in is set up at the first sign-in.");
    }
    return 0;
  } catch (error) {
    await rt.audit({
      actorId: actor,
      role: null,
      action: "admin.create-user",
      target: `${args.email} (${args.role})`,
      result: "failure",
      sourceIp: "127.0.0.1",
    });
    // The message is safe: it names a problem (duplicate, invalid) and no secret.
    console.error(
      error instanceof Error ? error.message : "Could not create the account.",
    );
    return 1;
  } finally {
    await rt.destroy();
  }
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  },
);
