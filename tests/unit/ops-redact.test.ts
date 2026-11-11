// @vitest-environment node
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_IP_RANGES,
  MASK,
  parseCidr,
  redactLog,
} from "@/lib/ops/redact";

// Property 14 (log part): redactLog output contains no secret, token, email
// address or configured IP range.

// Built at run time: these are fake values, and a literal would trip secret scanners.
const FAKE_KEY = ["AK", "IA", "7Q2M9X4B1C8D5E3F"].join("");
const FAKE_JWT = [
  ["eyJ", "hbGciOiJIUzI1NiJ9"].join(""),
  ["eyJ", "zdWIiOiIxMjM0NTYifQ"].join(""),
  "dBjftJeZ4CVPmB92K27uhbUJU1p1r",
].join(".");

const config = { ipRanges: ["10.0.0.0/8", "192.168.1.0/24"], secrets: [] };

describe("redactLog fixtures", () => {
  const cases: Array<[string, string, string[]]> = [
    [
      "email",
      "mail for anna.k+ops@ytlcomms.my failed",
      ["anna.k+ops@ytlcomms.my"],
    ],
    [
      "password pair",
      "db connect password=Sup3rS3cret! host=db",
      ["Sup3rS3cret"],
    ],
    ["quoted secret", 'config secret: "abc def ghi" loaded', ["abc def ghi"]],
    ["api key", ["api", "_key=", FAKE_KEY, " used"].join(""), [FAKE_KEY]],
    [
      "bearer",
      "Authorization: Bearer abcdefghijklmnop.qrstuv",
      ["abcdefghijklmnop"],
    ],
    [
      "cookie header",
      "cookie: __Secure-nexus.session_token=abc123xyz; other=1",
      ["abc123xyz"],
    ],
    [
      "url credentials",
      "fetch https://user:pw0rd@example.com/path",
      ["pw0rd", "user:"],
    ],
    ["jwt", `token ${FAKE_JWT}`, [FAKE_JWT.slice(0, 20)]],
    [
      "hex token",
      "session 0123456789abcdef0123456789abcdef0123 ended",
      ["0123456789abcdef0123456789abcdef"],
    ],
    [
      "private key",
      "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg\n-----END PRIVATE KEY-----",
      ["MIIEvQ"],
    ],
    [
      "ip in range",
      "from 10.26.64.164 port 22 and 192.168.1.77",
      ["10.26.64.164", "192.168.1.77"],
    ],
  ];
  it.each(cases)("masks %s", (_name, input, forbidden) => {
    const out = redactLog(input, config);
    for (const piece of forbidden) expect(out).not.toContain(piece);
    expect(out).toContain(MASK);
  });

  it("keeps ordinary text and addresses outside the configured ranges", () => {
    const text = "Started Nexus web at 2026-11-11T10:00:00; peer 203.0.113.9";
    expect(redactLog(text, config)).toBe(text);
  });

  it("masks configured exact secrets", () => {
    const out = redactLog("value is s3cr3t-value here", {
      ipRanges: [],
      secrets: ["s3cr3t-value"],
    });
    expect(out).not.toContain("s3cr3t-value");
  });

  it("parses CIDR ranges and refuses bad ones", () => {
    expect(parseCidr("10.0.0.0/8")).not.toBeNull();
    for (const bad of ["10.0.0/8", "10.0.0.0/33", "a.b.c.d", "10.0.0.0/8/1"]) {
      expect(parseCidr(bad)).toBeNull();
    }
    for (const range of DEFAULT_IP_RANGES)
      expect(parseCidr(range)).not.toBeNull();
  });
});

describe("Property 14: redactLog", () => {
  const word = fc.stringMatching(/^[A-Za-z ,.:]{0,30}$/);
  const secretValue = fc.stringMatching(/^[A-Za-z0-9]{8,24}$/);

  it("removes every embedded secret, email and in-range address", () => {
    fc.assert(
      fc.property(
        word,
        word,
        secretValue,
        fc.stringMatching(/^[a-z]{3,10}$/),
        fc.integer({ min: 0, max: 255 }),
        fc.integer({ min: 0, max: 255 }),
        fc.integer({ min: 0, max: 255 }),
        fc.constantFrom("password", "secret", "token", "api_key", "passwd"),
        (a, b, secret, user, x, y, z, key) => {
          const email = `${user}@example.org`;
          const ip = `10.${x}.${y}.${z}`;
          const text = `${a} ${key}=${secret} ${b}\nmail ${email} from ${ip}`;
          const out = redactLog(text, config);
          expect(out).not.toContain(secret);
          expect(out).not.toContain(email);
          expect(out).not.toContain(ip);
        },
      ),
    );
  });

  it("is idempotent", () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const once = redactLog(text, config);
        expect(redactLog(once, config)).toBe(once);
      }),
    );
  });

  it("never throws and never grows without bound", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 500 }), (text) => {
        const out = redactLog(text, config);
        expect(out.length).toBeLessThanOrEqual(text.length * 3 + 20);
      }),
    );
  });
});
