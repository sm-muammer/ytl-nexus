import { parseArgs } from "node:util";
import { z } from "zod";
import { ROLES } from "../../roles.ts";

// Arguments of the first-admin script (requirement 6.14), parsed and checked
// before anything touches the database.

const argsSchema = z.object({
  email: z.email().max(255),
  name: z.string().trim().min(1).max(120),
  role: z.enum(ROLES),
  passwordFromStdin: z.boolean(),
});

export type CreateUserArgs = z.infer<typeof argsSchema>;

export const USAGE = `Usage: npm run auth:create-user -- --email <address> --name "<full name>" [--role admin|operator|member|viewer] [--password-stdin]

Creates an account. The role defaults to admin, which is how the first
Administrator is made. Without --password-stdin a strong random password is
generated and printed once. Operators and Administrators set up two-factor
sign-in the first time they sign in.`;

export function parseCreateUserArgs(argv: string[]): CreateUserArgs {
  const { values } = parseArgs({
    args: argv,
    options: {
      email: { type: "string" },
      name: { type: "string" },
      role: { type: "string" },
      "password-stdin": { type: "boolean", default: false },
    },
    strict: true,
    allowPositionals: false,
  });
  const parsed = argsSchema.safeParse({
    email: values.email?.trim().toLowerCase(),
    name: values.name,
    role: values.role ?? "admin",
    passwordFromStdin: values["password-stdin"] ?? false,
  });
  if (!parsed.success) {
    const fields = [
      ...new Set(parsed.error.issues.map((i) => i.path.join("."))),
    ];
    throw new Error(`Invalid or missing: ${fields.join(", ")}.\n\n${USAGE}`);
  }
  return parsed.data;
}
