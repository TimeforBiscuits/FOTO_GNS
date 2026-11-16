# FOTO_GNS — Foto Gans

Lay out photos of different sizes and aspect ratios on A4 pages, and export
a 300 dpi PDF that prints at exactly the right size. Made for printing on
A4 photo paper and pasting into A4, A5 and A6 notebooks. A member of the
PJKT_GNS family.

It runs in the browser on macOS (Safari/Chrome) and iPad (Safari, installable
to the Home Screen). Photos never leave the device.

**Live:** https://timeforbiscuits.github.io/FOTO_GNS/

## How it works

1. **Formato:** pick an aspect ratio: 3×2, 2×3, 16×9 or 1×1.
2. **Misura:** pick a size, and a field appears on the page in the first free spot.
   - **Free:** resize it by dragging any corner. The ratio stays locked.
     You can also drag on the empty grid to draw one.
   - **A5 / A6:** a fixed, pre-registered size for that notebook. It can be
     moved but not resized.
3. Drag fields to place them. They snap to the 5 mm grid (hold ⌥ to place
   freely). Arrow keys nudge a selected field; ⌫ deletes it.
4. Tap the picture icon in a field to attach a photo. If its ratio isn't the
   field's (within 1 %), it's refused with a message. Nothing is ever cropped
   or stretched to fit.
5. Add more A4 pages as needed (**Pagine**, or **+ Page** at the top).
6. **Stampa / Export PDF:** in Chrome on the Mac it asks where to save. In
   Safari it downloads. On iPad it opens the share sheet, where you choose
   *Save to Files*.

Print at **100 % / Actual size** with "Fit to page" turned off.

## Sizes

The page is A4 (210 × 297 mm) with 10 mm side margins and 11 mm top and
bottom margins. The usable area is 190 × 275 mm, which is 38 × 55 grid
squares of 5 mm.

Pre-registered fields are the largest photo of the ratio that fits the box:

| Ratio | A5: half page, 1.5 cm spare (box 118 × 75) | A6: full page, 1 cm spare (box 85 × 128) |
| ----- | ------------------------------------------ | ---------------------------------------- |
| 3×2   | 112.5 × 75                                 | 85 × 56.7                                |
| 2×3   | 50 × 75                                    | 85 × 127.5                               |
| 16×9  | 118 × 66.4                                 | 85 × 47.8                                |
| 1×1   | 75 × 75                                    | 85 × 85                                  |

The boxes are defined in `src/model/layout.ts` (`PRESET_BOX`).

## Print quality

Each photo is resampled to exactly 300 dpi at its field size and embedded as
a high-quality JPEG. A photo with fewer pixels than that is used at its own
resolution, never upscaled. The Campo panel warns when a photo would print
under 200 dpi.

## Development

```sh
npm install
npm run dev      # local server
npm run check    # typecheck + lint + tests
npm run build
```

Every push to `main` is checked, built and published to the `gh-pages`
branch by `.github/workflows/deploy.yml`.
