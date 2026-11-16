# FOTO_GNS — Foto Gans

Lay out photos of different sizes and aspect ratios on A4 pages, and export
a 300 dpi PDF that prints at exactly the right size. Made for printing on
A4 photo paper and pasting into A4, A5 and A6 notebooks. A member of the
PJKT_GNS family.

It runs in the browser on macOS (Safari/Chrome) and iPad (Safari, installable
to the Home Screen). Photos never leave the device.

**Live:** https://timeforbiscuits.github.io/FOTO_GNS/

FOTO_GNS has two halves, chosen with the tabs at the top: **Selezione**
(curation) and **Impaginazione** (layout).

## Selezione: curation

Go through a folder of JPGs and keep only the ones you want.

1. **Open folder** (Mac) or **Open JPGs from Files** (iPad: go into the
   folder, tap *Select*, then *Select All*). Other file types are ignored.
2. Small previews are built in the background, starting with the photos near
   the one you're looking at. The big view shows a sharper preview of the
   current photo.
3. Mark keepers (*selezioni*): **P** keep, **X** leave behind, **Space**
   toggle, **← →** move, **G** grid / loupe. On iPad, swipe to move and
   double-tap to keep, or use the ★ on any thumbnail. *Next photo after
   deciding* moves on automatically.
4. **Create SELECTS** (the orange key, top right) makes a folder called
   `SELECTS` holding exact, untouched copies of every keeper:
   - **Chrome on the Mac:** choose where; `SELECTS` is created right there.
   - **Safari on the Mac:** browsers there can't create folders, so you get
     `SELECTS.zip`, which Safari unpacks into a `SELECTS` folder in Downloads.
   - **iPad:** `SELECTS.zip` goes to the share sheet → *Save to Files*; tap it
     once in Files and it opens into the `SELECTS` folder.
5. Everything you didn't keep is left behind. **FOTO_GNS never deletes or
   changes your originals.** Browsers can't delete files or move them to the
   Trash, so once SELECTS is made, delete the originals yourself (or the whole
   folder) in Finder or Files.

Selezioni are remembered on the device: open the same photos again and your
marks come back.

## Impaginazione: layout

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
6. **Stampa / Export PDF.** Type a name and the PDF is called
   `DDMMYY_name.pdf`, dated the day you export: "Tenerife trip" on
   16 November 2026 → `161126_tenerife-trip.pdf`. In Chrome on the Mac it asks where to save. In
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

**Originale** (the default) puts every JPEG into the PDF byte for byte: the
camera's full resolution, never decoded or re-compressed, with its embedded
colour profile (so Adobe RGB and Display P3 photos print true). Turning
sideways-stored portrait shots upright, and trimming the hair of difference
the 1 % ratio check allows, are done by the PDF itself, so no pixel changes.
PNGs go in losslessly. Other formats (HEIC, WebP) are converted once at full
resolution, JPEG quality 100. Files are as big as your photos: often
5–15 MB per photo.

**Compatto** resamples each photo to exactly 300 dpi at its printed size and
saves it as a JPEG at quality 95. The files are much smaller and look the
same in most prints.

Camera JPEGs are 8 bits per channel, so that's what the PDF holds. A 16-bit
PDF made from them would hold no more detail.

## Development

```sh
npm install
npm run dev      # local server
npm run check    # typecheck + lint + tests
npm run build
```

Every push to `main` is checked, built and published to the `gh-pages`
branch by `.github/workflows/deploy.yml`.
