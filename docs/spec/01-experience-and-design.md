# Experience and design: Adaptive Nexus

> **Purpose:** the visual, motion, accessibility and brand requirements every page must meet.
> **Audience:** anyone building or reviewing UI. Built in Tasks 2 (tokens and assets), 3 (shell and motion) and 20 (quality pass), applied in every module task.

## 1. Direction

**Adaptive Nexus** has two registers joined by one identity.

| Register            | Where                                                             | Character                                                                                                                                                                                                                    |
| ------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public and showcase | `/`, `/platform`, `/story`, `/tour`, `/library`, public `/status` | Warm, spacious, editorial, asymmetric. Large sub-brand names. Restrained cherry-blossom references. Drifting particles and soft depth transitions. Inspired by Shopify Editions (see `reference/inspiration/`), never copied |
| Operations          | Workspace routes and `/control`                                   | Dark, dense, precise. Clear status colours. Minimal decoration around controls. Visible role, environment and Live/Demo labels                                                                                               |

Shared identity: one animated **signal ribbon** connects modules during route transitions.

## 2. Colour roles

| Role              | Value                                            | Use                           |
| ----------------- | ------------------------------------------------ | ----------------------------- |
| YTL Blue          | `#00b4f0` (Pantone 2995 C)                       | Live infrastructure accents   |
| Signal pink       | Derived from the official Yes logomark in Task 2 | Brand and navigation          |
| Violet            | Defined in Task 2                                | Nexus AI                      |
| Green, amber, red | Defined in Task 2                                | Status only; never decorative |
| YTL Black         | `#3c3c3c` (Pantone Black 7 C)                    | Brand neutral                 |
| YTL Grey          | `#bcbcbc` (Cool Gray 6 C)                        | Brand neutral                 |

Components use semantic tokens, never raw hex values. Status is never conveyed by colour alone.

## 3. Typography

- Fonts must be open-licence. The Soho fonts embedded in the YTL guideline are not licensed for web use here.
- Candidates: an editorial serif (Fraunces or Instrument Serif) for public headings, Geist for UI, Geist Mono for data.
- Load fonts with `next/font/local` or a font npm package so server builds do not download fonts at build time.
- Body text at least 16 px, line height about 1.5. Data tables may use 14 px.

## 4. Motion

- Use Motion for React with `MotionConfig reducedMotion="user"`. Use view transitions where the installed Next.js and React versions support them.
- **Nexus Command** has an interactive particle field: one cluster per service, colour and motion reflect real health, gentle pointer response.
- Forms, tables, Nexus Control and the mail inbox use no heavy motion: short opacity and position feedback only.
- **Reduced motion is mandatory.** With `prefers-reduced-motion: reduce`, remove particles, parallax and large transforms; keep opacity transitions; show a static particle frame.
- Quality tiers scale particles by device pixel ratio, device memory and measured frame time. Rendering pauses when the tab is hidden.
- Motion conveys state or spatial continuity. Exits are faster than entrances.

## 5. "4K quality"

- SVG logos derived from the vector PDF masters.
- Sharp, well-hinted typography at every size.
- Responsive high-density images: AVIF/WebP with 2x or larger sources and correct `sizes`.
- GPU-conscious motion (transform and opacity only, lazy-loaded WebGL).
- Layouts tested at 3840 px width. No fixed 3840 px canvas.

## 6. Brand rules (YTL Communications logo guideline)

Source: `assets/source/ytl-communications/YTL Communications_Logo Guidelines.pdf`.

- Arrangements: **primary**, **left** (preferred for websites) and **centered** (centred layouts).
- Treatments: main colour; black wordmark (light backgrounds where black reads better than blue); reverse-white wordmark (dark backgrounds beside coloured logos); black monochrome (light backgrounds beside black or grey logos); reverse-white monochrome (dark backgrounds beside white logos).
- Clear space on every side equals the height of the "Nine Pillars" symbol.
- Minimum height 8 mm. Screen floor: 31 CSS px (8 mm at 96 px/in).
- Never separate the wordmark from the symbol, tilt, rotate, recolour or stretch the logo. Resize proportionally only.
- No separate Yes guideline exists in the supplied assets. Yes logomarks (gradient, pink, black, white) are never recoloured.

## 7. Accessibility

- WCAG 2.2 AA. Zero serious or critical axe violations is a CI gate.
- Text contrast at least 4.5:1 (3:1 for large text and UI boundaries).
- Every interactive element is keyboard reachable with a visible focus ring. Touch targets at least 44×44 px.
- Skip link on every layout. Landmarks and a single `h1` per page.
- Icon-only buttons carry accessible names. Decorative graphics are hidden from assistive technology.

## 8. Responsive behaviour

- Mobile first. Test widths: 390, 768, 1440, 2560 and 3840 px.
- No horizontal scrolling. No disabled zoom.
- Every layout has a real mobile navigation pattern.

## 9. Nexus Mail layout

Gmail-inspired three-pane information architecture without Gmail branding or exact styling: folder rail with a Compose button, search bar, message list, optional reading pane, compose drawer and keyboard shortcuts. On mobile the flow is folder, then list, then message. Details: [17 Nexus Mail](17-nexus-mail.md).

## 10. Yes Experience

Keeps its own cherry-blossom art direction and the official Yes colours inside the Nexus shell. Details: [19 Yes Experience](19-yes-experience.md).

## 11. Acceptance criteria

- Tokens, logos and type specimen are visible on `/design` and documented in `docs/design/`.
- Every route passes axe with zero serious violations at 390, 1440 and 3840 px.
- Reduced-motion mode removes particles, parallax and large transforms on every page.
- The particle field holds a smooth frame rate on the owner's Mac and drops tiers on weak devices.
- Logos render at 31 CSS px or taller with their aspect ratio preserved.
