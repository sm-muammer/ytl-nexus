import { describe, expect, it } from "vitest";
import { YES_FAQS, YES_PLANS } from "@/lib/yes/data";

describe("Yes Experience data", () => {
  it("defines plans with verified official links and honest pricing note", () => {
    expect(YES_PLANS.length).toBeGreaterThanOrEqual(3);
    for (const plan of YES_PLANS) {
      expect(plan.officialUrl).toMatch(/^https:\/\/www\.yes\.my\//);
      expect(plan.features.length).toBeGreaterThan(0);
      expect(plan.price).toMatch(/^RM\d+$/);
    }
  });

  it("defines FAQs with non-empty questions and answers", () => {
    expect(YES_FAQS.length).toBeGreaterThanOrEqual(3);
    for (const faq of YES_FAQS) {
      expect(faq.question.length).toBeGreaterThan(10);
      expect(faq.answer.length).toBeGreaterThan(10);
    }
  });
});
