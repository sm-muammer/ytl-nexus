# YTL Nexus motion implementation

> **Purpose:** how motion, route transitions and particle quality are built, so a change keeps the reduced-motion and performance rules.
> **Audience:** developers adding or changing animation. The rules themselves are in [`../design-language.md`](../design-language.md) section 4.

## Pieces

| Piece                                                         | File                                                                                   | What it does                                                                                                                                                                         |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `MotionProvider`                                              | `components/motion/motion-provider.tsx`                                                | Wraps the app once: `MotionConfig reducedMotion="user"` plus `LazyMotion` with `domAnimation` (keeps first-load JavaScript small). Motion components use `m.*` from `motion/react-m` |
| Entrance primitives `Fade`, `Rise`, `Stagger`                 | `components/motion/reveal.tsx`, classes `.nx-fade` and `.nx-rise` in `app/globals.css` | One-time fade, or fade with a 12 px rise, set per element by `--nx-delay`. Plain CSS, so the server-rendered page is visible without JavaScript and nothing waits for hydration      |
| `SignalRibbon`                                                | `components/motion/signal-ribbon.tsx`                                                  | A gradient line that sweeps across the top of the viewport on every route change (not on first load). Decorative, `aria-hidden`, transform and opacity only                          |
| `PageTransition`                                              | `components/motion/page-transition.tsx`                                                | React `ViewTransition` around page content: fade with a 6 px rise on enter, faster fade on exit. Header and footer are not named, so they stay still                                 |
| `AmbientField`                                                | `components/motion/ambient-field.tsx`                                                  | Canvas 2D drifting particles for public heroes. Not used on forms, tables, Nexus Control or the inbox                                                                                |
| `useQualityTier`, `usePageVisible`, `usePrefersReducedMotion` | `components/motion/use-*.ts`                                                           | React bindings for the rules below                                                                                                                                                   |
| Quality and visibility rules                                  | `lib/motion/quality.ts`                                                                | Pure functions and classes, unit-tested in `tests/unit/quality-tier.test.ts`                                                                                                         |

## Why entrances are CSS and the ribbon is Motion

Motion components render their starting state (opacity 0) into the server HTML, so text stays invisible until the page hydrates. That hurts largest contentful paint and shows nothing without JavaScript. The entrances therefore use CSS keyframes. Motion for React stays for state-driven motion where a JavaScript animation is the right tool: the ribbon now, and the Atlas and Command views later.

## View transitions

React's `ViewTransition` ships in the React that Next.js bundles for the App Router and needs no configuration ([Next.js guide](../../node_modules/next/dist/docs/01-app/02-guides/view-transitions.md)). Navigations are React transitions, so `PageTransition` animates automatically. Rules learned from the guide:

- Put `PageTransition` in the page, not the layout. Layouts persist across navigations, so enter and exit never fire there.
- `default="none"` stops it animating on unrelated transitions.
- The plain React used by Vitest has no `ViewTransition`; the wrapper then renders its children unchanged.
- `::view-transition-old(root)` and `::view-transition-new(root)` have `animation: none`, so the root does not cross-fade on top of the named content.

## Quality tiers

`AmbientField` draws `PARTICLE_COUNT[tier]` particles (120, 60 or 24).

1. The starting tier comes from the device. Each limit that applies lowers it one step from `high`: device pixel ratio above 2, and `navigator.deviceMemory` below 4 GB. Browsers that do not report memory are not penalised.
2. Every frame time goes to a 60-frame sliding window. When a full window averages above 20 ms the tier drops one more step and the window resets. The tier never rises again during a visit, so a weak device does not flicker.
3. Rendering resolution is capped at 2x device pixels, and at 1x on the `low` tier.

## Visibility

`observeVisibility` listens to `visibilitychange`. `AmbientField` stops its animation frame loop while the tab is hidden. When the tab shows again React re-renders and the loop restarts within a frame or two, well inside the 500 ms limit (`RESUME_DEADLINE_MS`). `tests/e2e/motion.spec.ts` checks the pause and the resume.

## Reduced motion

With `prefers-reduced-motion: reduce`:

| Thing                       | Behaviour                                                                                                  |
| --------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `AmbientField`              | Draws one deterministic static frame and never starts a loop (`data-state="static"`, `data-frames="1"`)    |
| Entrances and route changes | Fade only; no rise                                                                                         |
| Signal ribbon               | `MotionConfig` removes the scale, leaving a brief opacity pulse                                            |
| CSS transitions             | Only opacity and colour properties may transition; transform transitions are switched off in `globals.css` |
| Smooth scrolling            | Off                                                                                                        |

## Test hooks

`AmbientField` publishes `data-state` (`running`, `paused`, `static`), `data-tier`, `data-particles` and `data-frames`. Reveal elements carry `data-reveal`, and the ribbon carries `data-signal-ribbon` with `data-runs`. `tests/e2e/motion.spec.ts` uses them. Axe measures contrast mid-fade, so end-to-end tests wait for every `[data-reveal]` to reach opacity 1 before scanning (`settle()` in `tests/e2e/helpers.ts`).

Related: [Design language](../design-language.md) · [Structure](../structure.md)
