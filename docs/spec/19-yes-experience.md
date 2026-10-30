# Yes Experience: Yes website redesign

> **Purpose:** requirements for bringing the existing Yes redesign into Nexus as a complete, honest and polished experience.
> **Audience:** builders and reviewers of Task 15. Access: public.

## Summary

`yes-website-redesign/` is the only earlier project that may be reused. Its pages and components move into the `(yes)` route group under `/yes/*`, keep their cherry-blossom art direction, and gain the Nexus shell, accessibility standards and a link back to Nexus. Known defects are fixed and unverified claims are removed or labelled.

## Source project facts

Next.js 16.3.5, React 19.2.8, Tailwind v4. Pages: home, plans, coverage, support. Components: header, footer, plan card, FAQ item, chatbot, newsletter signup. `lib/api/*` are client-side simulations. Known defects:

- no mobile navigation (links hidden below `md`);
- dead "Get Started" and "Select Plan" controls;
- coverage-checker and support forms have no handlers;
- chatbot stale-state bug (the second state update uses the pre-submit `messages` array and drops the user message) and a fixed `w-96` panel;
- placeholder footer links and garbled social SVGs;
- hard-coded prices, coverage percentages, promotions and phone claims that are not verified Yes data.

## Requirements

| ID     | Requirement                                                                                                                          |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| YES-01 | Routes `/yes`, `/yes/plans`, `/yes/coverage`, `/yes/support` inside the Nexus shell with a clear way back to Nexus                   |
| YES-02 | Cherry-blossom art direction with official Yes logomarks and exact Yes colours; petal motion respects reduced motion                 |
| YES-03 | Real mobile navigation                                                                                                               |
| YES-04 | "Get Started" and "Select Plan" link to official yes.my pages or into a clearly labelled concept flow                                |
| YES-05 | Coverage and support forms validate input and show an honest confirmation (no fake submission success)                               |
| YES-06 | Chatbot keeps every user message, fits narrow screens, and uses the `yes-public` Nexus AI scope                                      |
| YES-07 | Footer and social links point to official Yes destinations                                                                           |
| YES-08 | Prices, coverage and promotions use official yes.my wording with the source noted, or are marked "Concept design – not live pricing" |

## Acceptance criteria

- e2e tests for home, plans, coverage and support pass.
- Mobile navigation and chatbot regressions are covered (the user message persists after the reply).
- axe shows zero serious violations at 390 and 3840 px.
- Browsing on mobile and at 4K works, chat works, and the user can return to Nexus.

## Related

[Design language](../design-language.md) · [18 AI, `yes-public` scope](18-nexus-ai.md)
