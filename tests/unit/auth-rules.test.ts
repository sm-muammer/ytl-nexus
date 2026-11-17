import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  ABSOLUTE_TIMEOUT_MS,
  IDLE_TIMEOUT_MS,
  LOCKOUT_DURATION_MS,
  LOCKOUT_FAILURES,
  LOCKOUT_WINDOW_MS,
  STEP_UP_WINDOW_MS,
  isSessionValid,
  isStepUpFresh,
  lockedUntil,
  requiresTwoFactor,
  sessionVerdict,
} from "@/lib/server/auth/rules";

const MIN = 60_000;
const HOUR = 60 * MIN;

describe("limits", () => {
  it("match the requirements", () => {
    expect(IDLE_TIMEOUT_MS).toBe(60 * MIN);
    expect(ABSOLUTE_TIMEOUT_MS).toBe(12 * HOUR);
    expect(STEP_UP_WINDOW_MS).toBe(10 * MIN);
    expect(LOCKOUT_FAILURES).toBe(5);
    expect(LOCKOUT_WINDOW_MS).toBe(15 * MIN);
    expect(LOCKOUT_DURATION_MS).toBe(15 * MIN);
  });
});

describe("Property 7a: session validity (requirements 6.16, 6.17)", () => {
  it("is valid exactly when idle < 60 min, age < 12 h and not revoked", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 20 * HOUR }), // age
        fc.integer({ min: 0, max: 20 * HOUR }), // idle (may exceed age: clamp below)
        fc.boolean(),
        (age, idleRaw, revoked) => {
          const idle = Math.min(idleRaw, age);
          const now = 1_800_000_000_000;
          const input = {
            now,
            createdAt: now - age,
            lastActivityAt: now - idle,
            revoked,
          };
          const expected =
            !revoked && idle < IDLE_TIMEOUT_MS && age < ABSOLUTE_TIMEOUT_MS;
          expect(isSessionValid(input)).toBe(expected);
        },
      ),
      { numRuns: 500 },
    );
  });

  it("names the reason, revocation first", () => {
    const now = 10 * HOUR;
    const base = { now, createdAt: now - HOUR, lastActivityAt: now - MIN };
    expect(sessionVerdict(base)).toBe("valid");
    expect(sessionVerdict({ ...base, lastActivityAt: now - 61 * MIN })).toBe(
      "idle",
    );
    expect(sessionVerdict({ ...base, createdAt: now - 13 * HOUR })).toBe(
      "expired",
    );
    expect(
      sessionVerdict({
        ...base,
        createdAt: now - 13 * HOUR,
        lastActivityAt: now - 61 * MIN,
        revoked: true,
      }),
    ).toBe("revoked");
  });

  it("treats the exact boundaries as expired", () => {
    const now = 20 * HOUR;
    expect(
      isSessionValid({
        now,
        createdAt: now - HOUR,
        lastActivityAt: now - IDLE_TIMEOUT_MS,
      }),
    ).toBe(false);
    expect(
      isSessionValid({
        now,
        createdAt: now - ABSOLUTE_TIMEOUT_MS,
        lastActivityAt: now - MIN,
      }),
    ).toBe(false);
    expect(
      isSessionValid({
        now,
        createdAt: now - ABSOLUTE_TIMEOUT_MS + 1,
        lastActivityAt: now - IDLE_TIMEOUT_MS + 1,
      }),
    ).toBe(true);
  });

  it("treats a session that claims to be from the future as invalid", () => {
    const now = 5 * HOUR;
    expect(
      isSessionValid({
        now,
        createdAt: now + MIN,
        lastActivityAt: now + MIN,
      }),
    ).toBe(false);
  });
});

// An independent model of the lockout rule: try every set of five failures.
function referenceLocked(failures: number[], now: number): boolean {
  const sorted = [...failures].sort((a, b) => a - b);
  const n = sorted.length;
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++)
        for (let d = c + 1; d < n; d++)
          for (let e = d + 1; e < n; e++) {
            const first = sorted[a] as number;
            const last = sorted[e] as number;
            if (
              last - first <= LOCKOUT_WINDOW_MS &&
              now < last + LOCKOUT_DURATION_MS &&
              last <= now
            ) {
              return true;
            }
          }
  return false;
}

describe("Property 7b: sign-in lockout (requirement 6.18)", () => {
  const times = fc.array(fc.integer({ min: 0, max: 60 * MIN }), {
    maxLength: 9,
  });

  it("matches an independent model for any failures and any clock", () => {
    fc.assert(
      fc.property(times, fc.integer({ min: 0, max: 120 * MIN }), (f, now) => {
        const past = f.filter((t) => t <= now);
        expect(lockedUntil(past, now) !== null).toBe(
          referenceLocked(past, now),
        );
      }),
      { numRuns: 1000 },
    );
  });

  it("never locks on fewer than 5 failures", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 15 * MIN }), { maxLength: 4 }),
        fc.integer({ min: 0, max: 15 * MIN }),
        (f, now) => {
          expect(
            lockedUntil(
              f.filter((t) => t <= now),
              now,
            ),
          ).toBeNull();
        },
      ),
    );
  });

  it("locks at the 5th failure inside 15 minutes and unlocks 15 minutes later", () => {
    const t0 = 1_000_000;
    const failures = [0, 1, 2, 3, 4].map((i) => t0 + i * MIN);
    const fifth = failures[4] as number;
    expect(lockedUntil(failures.slice(0, 4), fifth)).toBeNull();
    expect(lockedUntil(failures, fifth)).toBe(fifth + LOCKOUT_DURATION_MS);
    expect(
      lockedUntil(failures, fifth + LOCKOUT_DURATION_MS - 1),
    ).not.toBeNull();
    expect(lockedUntil(failures, fifth + LOCKOUT_DURATION_MS)).toBeNull();
  });

  it("does not lock when 5 failures are spread over more than 15 minutes", () => {
    const failures = [0, 4, 8, 12, 16].map((m) => m * MIN);
    expect(lockedUntil(failures, 16 * MIN)).toBeNull();
  });

  it("a single failure right after a lockout ends starts a fresh count", () => {
    const failures = [0, 1, 2, 3, 4].map((m) => m * MIN);
    const after = 4 * MIN + LOCKOUT_DURATION_MS;
    expect(lockedUntil([...failures, after], after)).toBeNull();
  });
});

describe("step-up and enrolment rules", () => {
  it("step-up is fresh for under 10 minutes only", () => {
    const now = 3 * HOUR;
    expect(isStepUpFresh(null, now)).toBe(false);
    expect(isStepUpFresh(now - 9 * MIN, now)).toBe(true);
    expect(isStepUpFresh(now - STEP_UP_WINDOW_MS, now)).toBe(false);
    expect(isStepUpFresh(now + MIN, now)).toBe(false);
  });

  it("two-factor is required for administrators only", () => {
    expect(requiresTwoFactor("viewer")).toBe(false);
    expect(requiresTwoFactor("member")).toBe(false);
    expect(requiresTwoFactor("operator")).toBe(false);
    expect(requiresTwoFactor("admin")).toBe(true);
  });
});
