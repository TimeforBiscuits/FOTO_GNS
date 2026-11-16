// Everything about the page, in millimetres.

export const A4 = { w: 210, h: 297 }

/** Normal printing margins. The top and bottom are a touch deeper so the grid lands on whole squares. */
export const MARGIN = { x: 10, y: 11 }

/** One grid square. */
export const GRID = 5

/** The usable area inside the margins: 38 × 55 squares. */
export const AREA = { x: MARGIN.x, y: MARGIN.y, w: A4.w - 2 * MARGIN.x, h: A4.h - 2 * MARGIN.y }

export const COLS = Math.round(AREA.w / GRID)
export const ROWS = Math.round(AREA.h / GRID)

export type RatioId = '3x2' | '2x3' | '16x9' | '1x1'
export const RATIO_IDS: RatioId[] = ['3x2', '2x3', '16x9', '1x1']

export const RATIOS: Record<RatioId, { w: number; h: number; label: string }> = {
  '3x2': { w: 3, h: 2, label: '3×2' },
  '2x3': { w: 2, h: 3, label: '2×3' },
  '16x9': { w: 16, h: 9, label: '16×9' },
  '1x1': { w: 1, h: 1, label: '1×1' },
}

/** Width over height. */
export const ratioOf = (id: RatioId) => RATIOS[id].w / RATIOS[id].h

export type SizeId = 'free' | 'a5' | 'a6'

/**
 * The box a pre-registered photo must fit inside, for each notebook.
 *
 * A5 (148 × 210): the top half of the page (148 × 105) with 1.5 cm spare on
 * every side, so the photo sits above the cut-off line → 118 × 75.
 *
 * A6 (105 × 148): most of the page, 1 cm in from every edge → 85 × 128.
 */
export const PRESET_BOX: Record<Exclude<SizeId, 'free'>, { w: number; h: number; name: string; page: string; note: string }> = {
  a5: { w: 148 - 30, h: 105 - 30, name: 'A5', page: '148×210', note: 'half page · 1.5 cm spare' },
  a6: { w: 105 - 20, h: 148 - 20, name: 'A6', page: '105×148', note: 'full page · 1 cm spare' },
}

/** The largest photo of this ratio that fits the box. */
export function fitInBox(ratio: RatioId, box: { w: number; h: number }) {
  const r = ratioOf(ratio)
  const w = Math.min(box.w, box.h * r)
  return { w: round2(w), h: round2(w / r) }
}

export const presetSize = (ratio: RatioId, size: Exclude<SizeId, 'free'>) => fitInBox(ratio, PRESET_BOX[size])

/** A sensible starting size for a free field: 12 squares on its long side. */
export function freeStartSize(ratio: RatioId) {
  const r = ratioOf(ratio)
  const long = 12 * GRID
  return r >= 1 ? { w: long, h: round2(long / r) } : { w: round2(long * r), h: long }
}

/** The smallest a free field may be: 3 squares on its short side. */
export const MIN_SHORT = 3 * GRID

export const round2 = (v: number) => Math.round(v * 100) / 100

export const snap = (v: number, step = GRID) => Math.round(v / step) * step

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w - 0.01 && b.x < a.x + a.w - 0.01 && a.y < b.y + b.h - 0.01 && b.y < a.y + a.h - 0.01

/** Keep a rectangle inside the usable area. */
export function clampToArea(r: Rect): Rect {
  const x = Math.min(Math.max(r.x, AREA.x), AREA.x + AREA.w - r.w)
  const y = Math.min(Math.max(r.y, AREA.y), AREA.y + AREA.h - r.h)
  return { ...r, x, y }
}

/** Snap the top-left corner to the grid, then keep it inside. */
export function snapPosition(r: Rect): Rect {
  return clampToArea({ ...r, x: AREA.x + snap(r.x - AREA.x), y: AREA.y + snap(r.y - AREA.y) })
}

/** The first grid spot, reading left to right and top to bottom, where a w × h field overlaps nothing. */
export function findSpot(w: number, h: number, taken: Rect[]): { x: number; y: number } | null {
  for (let row = 0; row <= ROWS; row++) {
    const y = AREA.y + row * GRID
    if (y + h > AREA.y + AREA.h + 0.01) break
    for (let col = 0; col <= COLS; col++) {
      const x = AREA.x + col * GRID
      if (x + w > AREA.x + AREA.w + 0.01) break
      const r = { x, y, w, h }
      if (!taken.some((t) => overlaps(r, t))) return { x, y }
    }
  }
  return null
}

export type Corner = 'nw' | 'ne' | 'sw' | 'se'

/**
 * Resize an aspect-locked field by dragging one corner; the opposite corner
 * stays put. The width snaps to whole grid squares unless `free` is set.
 */
export function resizeFromCorner(r: Rect, corner: Corner, p: { x: number; y: number }, ratio: number, free = false): Rect {
  const ax = corner === 'nw' || corner === 'sw' ? r.x + r.w : r.x
  const ay = corner === 'nw' || corner === 'ne' ? r.y + r.h : r.y
  const dirX = corner === 'nw' || corner === 'sw' ? -1 : 1
  const dirY = corner === 'nw' || corner === 'ne' ? -1 : 1

  // How far the corner may go before leaving the usable area.
  const maxW = Math.min(dirX > 0 ? AREA.x + AREA.w - ax : ax - AREA.x, (dirY > 0 ? AREA.y + AREA.h - ay : ay - AREA.y) * ratio)
  const minW = ratio >= 1 ? MIN_SHORT * ratio : MIN_SHORT

  let w = Math.max((p.x - ax) * dirX, (p.y - ay) * dirY * ratio)
  if (!free) w = snap(w)
  w = Math.min(maxW, Math.max(minW, w))
  w = round2(w)
  const h = round2(w / ratio)
  return { x: dirX > 0 ? ax : round2(ax - w), y: dirY > 0 ? ay : round2(ay - h), w, h }
}

/** How close a picture's shape must be to its field's: 1 %. */
export const RATIO_TOLERANCE = 0.01

export const ratioMatches = (pxW: number, pxH: number, ratio: RatioId) => Math.abs(pxW / pxH / ratioOf(ratio) - 1) <= RATIO_TOLERANCE

/** Describe a picture's shape in words, e.g. "4×3" or "1.33 : 1". */
export function describeRatio(pxW: number, pxH: number) {
  const known: [string, number][] = [
    ['3×2', 3 / 2],
    ['2×3', 2 / 3],
    ['16×9', 16 / 9],
    ['9×16', 9 / 16],
    ['1×1', 1],
    ['4×3', 4 / 3],
    ['3×4', 3 / 4],
    ['5×4', 5 / 4],
    ['4×5', 4 / 5],
  ]
  const r = pxW / pxH
  const hit = known.find(([, k]) => Math.abs(r / k - 1) <= RATIO_TOLERANCE)
  return hit ? hit[0] : `${r.toFixed(2)} : 1`
}

export const MM_PER_INCH = 25.4
export const PRINT_DPI = 300

/** The resolution a picture prints at in a field of this width. */
export const effectiveDpi = (pxW: number, widthMm: number) => Math.round(pxW / (widthMm / MM_PER_INCH))

export const fmtMm = (v: number) => (Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1))
