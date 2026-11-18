# 24 Home showcase: 3D particle Yes logomark

> **Purpose:** the redesign of the home page (`/`) around a WebGL particle rendering of the Yes logomark, and the visual language the rest of the page follows.
> **Audience:** the agent implementing it and anyone reviewing the home page. Parent rules: [`design-language.md`](../design-language.md), [`design/motion.md`](../design/motion.md).

## 1. Decisions

| ID    | Decision                                                                                                                                                                                                                                                                                                                                |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-240 | The hero mark is the **Yes logomark gradient** (`public/brand/yes-logomark-gradient.svg`) rendered as dense 3D particles. The owner chose it and accepted that it rotates (2026-11-18). No Yes guideline exists in the supplied assets; the YTL Communications logo is **not** used this way and stays static in the header and footer. |
| D-241 | Particle colours are **sampled from the official SVG's pixels**, so the mark is never recoloured.                                                                                                                                                                                                                                       |
| D-242 | Renderer: `three` (core only, no React Three Fiber, no postprocessing package), loaded with `next/dynamic` (`ssr: false`) **only on `/`**.                                                                                                                                                                                              |
| D-243 | One fixed full-viewport WebGL canvas on `/` replaces the 2D `aurora` canvas for that route (`lib/navigation/scenes.ts`: `"/"` keeps the `aurora` tint, drops `canvas`). Scrolling scatters the logomark into a drifting particle field that stays behind the lower sections, so the whole page shares one particle layer.               |

## 2. Particle logomark (`components/home/particle-logo.tsx` + `lib/motion/particle-logo/*.ts`)

**Sampling (pure, unit-tested):** rasterise the SVG to an offscreen canvas (about 768 px on its long side) and keep pixels with alpha above 0.5. Walk the edge-weighted pixel pool via stratified sampling (`jitterStep = 0.28`) so the mark has uniform density without clumping. Each particle gets:

- `position`: x and y centred and normalised so the mark is about 2.2 world units tall. z gives the mark thickness: 70 % of particles sit on the front and back faces (z = ±0.12) and 30 % sit on 5 quantized internal depth slices (scaled 2.1× in the vertex shader for sculptural 3D slab depth). Edge pixels (any transparent neighbour) count double, so the silhouette reads sharp when the mark turns side-on.
- `normal`: 3D unit vector derived from a 3×3 Sobel alpha gradient for front/back bevels and side walls, used in view space to dim rear faces (preventing double-ghosting) and add rim/key lighting.
- `color`: the sampled pixel's exact RGB (`COLOR_BRIGHTNESS_BOOST = 1`), perceptually lifted in the vertex shader (`pow(aColor, 0.78) + vec3(0.05, 0.06, 0.12)`) so indigo and pink tones read vividly against both the dark canvas and bright white backlight.
- `scatter`: a random point in a wide ellipsoid (radius about 6, flattened in y) used for scroll dispersal and the intro.
- `seed`: a random float in [0, 1) used for shimmer and size variation.

Surrounding ambient layer: `sampleAmbientDust` places 65 % of motes along 3 tilted 3D orbital torus rings around the mark and 35 % in a deep parallax starfield tinted in warm rose, violet-indigo and starlight (5 000 / 3 500 / 2 000 by tier).

**Counts by quality tier:** high 140 000, medium 70 000, low 30 000 (use `useQualityTier`; frame times feed `reportFrame`). Device pixel ratio is capped at 2.

**Shader (`ShaderMaterial`, `Points`, `NormalBlending`, `depthWrite: false`):**

- Each point is drawn as an opaque-core Gaussian sprite (`core = exp(-d * d * 8.0)`, `halo = exp(-d * d * 2.8) * 0.42`, `alpha` clamped to `0.96`; `gl_FragColor = vec4(col, alpha)`) so the mark stays dense and crisp against the bright pearlescent white studio backlight (`basePointSize = 4.6 * (baseCameraZ / 4.4)`, clamped `1.2..9.5` px; `TIER_INTENSITY`: high `0.88`, medium `0.94`, low `1.0`). Size varies modestly by `seed` and stays consistent across mobile and desktop viewports via `camera.setViewOffset` (eliminating off-axis desktop perspective stretch).
- Sheen & shimmer: coherent diagonal surface sheen plus subtle ±7 % per-particle shimmer (`seed`-phased) and a gentle continuous 3D surface wave (`0.016`).
- `uMorph` (0 = logo, 1 = scattered) blends `position` toward `scatter` with a per-particle delay of `seed * 0.3` and an ease-in-out curve.
- Pointer ripple: `uPointer` is the pointer in object space, found by casting a ray onto the plane z = 0 of the mark. Particles within `uRadius` (0.32) lift in +z (`0.12`) with a subtle swirl (`0.028`) and luminance shift while keeping the lettering crisp. `uPointerStrength` eases to 0 when the pointer leaves.

**Motion:**

| Input                       | Behaviour                                                                                                                                                                                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Load                        | Intro: `uMorph` animates from 1 to 0 over 1.8 s, so the particles converge into the mark.                                                                                                                                                                           |
| Idle                        | Smooth rotation around y at about 0.18 rad/s plus a gentle x wobble (±0.08 rad, 9 s period). It resumes 1.5 s after the last interaction, easing back in.                                                                                                           |
| Pointer move                | The whole group tilts toward the pointer (±0.3 rad, smoothed), and particles near the pointer are repelled. Touch works the same way.                                                                                                                               |
| Drag                        | Pointer drag on the canvas spins the mark around y with inertia (velocity decays).                                                                                                                                                                                  |
| Vertical scroll             | Progress p = scrollY / (0.9 × viewport height), clamped to [0, 1]. `uMorph = ease(p)`, the group moves back slightly in z and the camera dollies. After p = 1 the scattered field drifts slowly at 40 % opacity behind the content. Scrolling up re-forms the mark. |
| Horizontal wheel (`deltaX`) | Adds a rotation impulse around y. Never call `preventDefault` on wheel events.                                                                                                                                                                                      |

**Lifecycle and safety:**

- Render only while the tab is visible (`usePageVisible`).
- Dispose the geometry, material and renderer on unmount.
- Recreate the geometry when the tier changes.
- With reduced motion (`usePrefersReducedMotion`), render one static frame of the formed mark: no rotation, pointer, scroll or intro.
- If WebGL is unavailable or the context is lost, fall back to the static `<Logo slug="yes-logomark-gradient">` shown centred.
- The canvas is `aria-hidden` and `pointer-events` are on only within the hero.
- Data attributes for tests: `data-state` (running | paused | static | fallback), `data-tier`, `data-particles`.

## 3. Page layout (`app/(public)/page.tsx`)

Same honest copy as today. The visual language is **deep navy ink, luminous particles, glass surfaces, thin gradient hairlines and mono eyebrows**. Use only semantic tokens; add new ones to `app/globals.css` and `lib/design/tokens.ts` and keep the sync test green.

1. **Hero (100 dvh):** clean editorial hero over the lifted `.nx-tint-aurora` backdrop (full obsidian canvas without extra black darkening, paired with ambient ink/violet/pink highlights). On large screens, text on the left (mono eyebrow "Internship project · YTL Communications", the `h1` "YTL Nexus", the lead copy crediting Muammer, both CTAs, and a restrained hairline colophon naming Muammer, Nexus Core 01 and 16 unified modules) and `[data-particle-stage]` with a bright `78%` pearlescent white studio `.nx-logo-backlight` splash (`size-[min(78vw,22rem)] lg:size-[min(38vw,28rem)]`) on the right. On mobile, the mark sits above the text. A small animated scroll cue sits at the bottom.
2. **Facts strip:** four code-derived numbers (`PUBLIC_MODULES.length` modules, 1 server, 1 sign-in, Live/Demo labelled) in an open horizontal hairline strip (`border-y divide-x`). These are facts about the project, not live metrics, and are labelled that way.
3. **Modules Swiss hairline matrix:** a sticky left editorial column (`Modules` + summary) paired with a flush 2-column architectural grid (`border-t border-l`, each `<li>` carrying `border-r border-b`). `Nexus Command` and `Yes Experience` span full 2-column rows (`md:col-span-2`), while the 12 intermediate modules form 6 balanced 2-column pairs. Each cell (`BentoCard`) renders cleanly over the backdrop with a pointer-following `--mx`/`--my` radial spotlight on hover, keeping only the module name, plain-text access label, single summary, and correct `<a>` or `<Link>` element.
4. **"How it fits together" teaser:** open hairline section with three tiers (`Ingress`, `Nexus Core 01`, `Services`) joined by an animated gradient signal line (CSS transform and opacity only), linking to `/platform`.
5. **About this project:** clean border-top editorial section crediting Muammer and linking to `/story`.

Sections reveal on scroll with the existing `Reveal` and `Rise` components. Respect reduced motion. Keep one `h1`, landmarks, 44 px touch targets and a visible focus ring. There is no horizontal scrolling at 390, 768, 1440, 2560 or 3840 px.

## 4. Tests and demo

- **Unit (Vitest), written first:** sampling (count equals the target, positions within bounds, colours come only from opaque pixels, edge weighting), tier → count mapping, scroll progress mapping and clamping, the updated `"/"` scene in `lib/navigation/scenes.ts`, and the token sync test.
- **E2E (Playwright):** `/` shows the canvas with `data-state="running"`. With `reducedMotion: "reduce"` it shows `static`. Axe reports zero serious violations at 390 and 1440 px.
- **Bundle:** `three` is absent from every route chunk except `/` (`npm run quality:bundles`).
- **Demo:** open `/`. The mark forms, rotates while idle, tilts and repels around the pointer, scatters on scroll down and re-forms on scroll up.
- `npm run check` passes. Docs (`design-language.md`, `design/motion.md`, `PROGRESS.md`) are updated in the same commit.
