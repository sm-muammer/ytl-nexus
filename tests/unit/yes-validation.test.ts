import { describe, expect, it } from "vitest";
import {
  coverageSchema,
  newsletterSchema,
  supportSchema,
} from "@/lib/yes/validation";

describe("Yes Experience validation schemas", () => {
  describe("coverageSchema", () => {
    it("accepts valid location addresses", () => {
      const res = coverageSchema.safeParse({ address: "Kuala Lumpur Sentral" });
      expect(res.success).toBe(true);
    });

    it("rejects short or empty address", () => {
      expect(coverageSchema.safeParse({ address: "  " }).success).toBe(false);
      expect(coverageSchema.safeParse({ address: "kl" }).success).toBe(false);
    });

    it("rejects excessively long addresses", () => {
      expect(
        coverageSchema.safeParse({ address: "a".repeat(200) }).success,
      ).toBe(false);
    });
  });

  describe("supportSchema", () => {
    it("accepts complete valid support request", () => {
      const res = supportSchema.safeParse({
        name: "Muammer",
        email: "user@example.com",
        subject: "5G roaming query",
        message: "Can I use 5G roaming in Singapore with my plan?",
      });
      expect(res.success).toBe(true);
    });

    it("rejects invalid email and short messages", () => {
      expect(
        supportSchema.safeParse({
          name: "M",
          email: "not-an-email",
          subject: "hi",
          message: "short",
        }).success,
      ).toBe(false);
    });
  });

  describe("newsletterSchema", () => {
    it("accepts valid email and rejects invalid", () => {
      expect(
        newsletterSchema.safeParse({ email: "subscriber@ytl.com" }).success,
      ).toBe(true);
      expect(newsletterSchema.safeParse({ email: "subscriber@" }).success).toBe(
        false,
      );
    });
  });
});
