# Asset sourcing

> **Purpose:** where brand assets, photos and fonts may come from, and what is never allowed.
> **Audience:** anyone adding an image, logo or font to YTL Nexus.

## Allowed sources

| Kind                   | Source                                                                                                                         | Record                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| YTL and Yes logos      | The official press and media kit from YTL Corporate Communications. Masters live in `assets/source/` and are never overwritten | `assets/asset-manifest.md`                 |
| Yes product imagery    | Official Yes channels (yes.my, official social accounts) or the media kit                                                      | Source URL or kit name in the manifest     |
| Photos of the platform | Your own screenshots at 2x or larger, taken from the running Nexus (Demo mode data only)                                       | File name and capture date in the manifest |
| Illustrations, renders | Made in this project (SVG, CSS, canvas or WebGL), or generated from the project's own data                                     | The script or component path               |
| Fonts                  | Open-licence fonts shipped in `app/fonts/` with their licence text: Geist, Geist Mono and Fraunces (SIL Open Font License 1.1) | Licence files beside the font files        |

## Never allowed

- Stock images with an unclear licence, or any image copied from another site.
- The Soho fonts embedded in the YTL logo guideline. They are not licensed for web use here.
- Recoloured, stretched, tilted or re-drawn YTL or Yes logos. Resize proportionally only.
- Files from `reference/`. It is inspiration only and is never copied into the product.

## Naming

Files and folders are kebab-case: lowercase letters, digits and hyphens. Words such as `final`, `copy`, `untitled`, `screenshot`, `temp`, `tmp`, `backup` and `old` are banned. `npm run assets:check` enforces this for `public/` and `assets/` (except `assets/source/`, which keeps the original official filenames) and runs in CI.

## Brand assets pipeline

`npm run assets:convert` turns the official PDF masters into cropped SVG files and sRGB PNG fallbacks in `public/brand/` and rewrites `assets/asset-manifest.md`. It needs `pdftocairo` (`brew install poppler`) only when masters change; the output is committed. See the manifest for the steps and the replacement procedure.

Names: `ytl-communications-{primary|left|centered}-{main-colour|black-wordmark|reverse-white-wordmark|black-monochrome|reverse-white-monochrome}.svg`, `yes-logomark-{gradient|pink|black|white}.svg`, and PNG fallbacks `<name>-w{width}.png` at 1x and 2x of the display width.

## Requests to make

1. Ask Logesh or YTL Corporate Communications for the official YTL and Yes media kit.
2. Ask for any official photos you want to use, with written permission to publish them on the project site.
3. Record each reply and file in `assets/asset-manifest.md` before using the file.

## Clear space and sizes

- YTL: clear space on every side equals the height of the "Nine Pillars" symbol. In the primary and left logos that is the full logo height. In the centred logo it is about half the logo height (measured from the guideline artwork; confirm with Corporate Communications).
- Minimum rendered height is 31 CSS px (8 mm at 96 px/in). The `Logo` component raises smaller values.
- Yes: no guideline was supplied. `/design` shows a quarter of the mark's height as a working value; replace it when Yes guidance arrives.
