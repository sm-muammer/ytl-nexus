"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { DEMO_ROLE_COOKIE } from "@/lib/fixtures/session";
import { ROLES } from "@/lib/roles";
import { getMode } from "@/lib/server/mode";

// Server Functions are public endpoints, so this one checks the mode and
// validates its input itself. It changes only a presentation cookie that the
// demo auth adapter reads; it grants nothing in Live_Mode.

const input = z.object({ role: z.enum([...ROLES, "visitor"]) });

const TWELVE_HOURS = 60 * 60 * 12;

export async function setDemoSession(formData: FormData): Promise<void> {
  if (getMode() !== "demo") return;

  const parsed = input.safeParse({ role: formData.get("role") });
  if (!parsed.success) return;

  const jar = await cookies();
  if (parsed.data.role === "visitor") {
    jar.delete(DEMO_ROLE_COOKIE);
    return;
  }
  jar.set(DEMO_ROLE_COOKIE, parsed.data.role, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TWELVE_HOURS,
  });
}
