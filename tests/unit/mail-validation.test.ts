// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  deleteMailboxInput,
  localPartSchema,
  mailAddressSchema,
  quotaMbSchema,
} from "@/lib/mail/validation";

describe("localPartSchema", () => {
  it.each([
    "amira",
    "john.doe",
    "logesh-k",
    "user_123",
    "team-support",
    "svc.alerts",
  ])("accepts valid local part %j", (name) => {
    expect(localPartSchema.safeParse(name).success).toBe(true);
  });

  it.each([
    ["ab", "too short"],
    ["a".repeat(65), "too long"],
    ["-start", "starts with hyphen"],
    [".dotstart", "starts with dot"],
    ["end-", "ends with hyphen"],
    ["two..dots", "double dot"],
    ["UPPER", "uppercase letters"],
    ["root", "reserved"],
    ["admin", "reserved"],
    ["postmaster", "reserved"],
    ["abuse", "reserved"],
    ["noreply", "reserved"],
    ["webmaster", "reserved"],
  ])("refuses %j (%s)", (name) => {
    expect(localPartSchema.safeParse(name).success).toBe(false);
  });
});

describe("mailAddressSchema", () => {
  it("accepts an address ending in @ytl-nexus.internal", () => {
    expect(
      mailAddressSchema.safeParse("amira@ytl-nexus.internal").success,
    ).toBe(true);
  });

  it.each([
    "amira@gmail.com",
    "amira@ytl.com",
    "amira@other.internal",
    "bad..dots@ytl-nexus.internal",
    "not-an-email",
    "",
  ])("refuses %j outside the virtual domain", (address) => {
    expect(mailAddressSchema.safeParse(address).success).toBe(false);
  });
});

describe("quotaMbSchema", () => {
  it("accepts quotas within the allowed range (10 MB to 2048 MB)", () => {
    expect(quotaMbSchema.safeParse(10).success).toBe(true);
    expect(quotaMbSchema.safeParse(512).success).toBe(true);
    expect(quotaMbSchema.safeParse(2048).success).toBe(true);
    expect(quotaMbSchema.safeParse("1024").success).toBe(true);
  });

  it("refuses quotas outside the bounds", () => {
    expect(quotaMbSchema.safeParse(9).success).toBe(false);
    expect(quotaMbSchema.safeParse(2049).success).toBe(false);
    expect(quotaMbSchema.safeParse(0).success).toBe(false);
    expect(quotaMbSchema.safeParse(-10).success).toBe(false);
  });
});

describe("deleteMailboxInput", () => {
  it("requires confirm to match address exactly", () => {
    expect(
      deleteMailboxInput.safeParse({
        address: "amira@ytl-nexus.internal",
        confirm: "amira@ytl-nexus.internal",
      }).success,
    ).toBe(true);

    expect(
      deleteMailboxInput.safeParse({
        address: "amira@ytl-nexus.internal",
        confirm: "different@ytl-nexus.internal",
      }).success,
    ).toBe(false);
  });
});
