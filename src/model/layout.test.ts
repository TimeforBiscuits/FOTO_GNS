import { describe, expect, it } from 'vitest'
import { AREA, COLS, ROWS, findSpot, presetSize, ratioMatches, resizeFromCorner, snapPosition, describeRatio } from './layout'
import { targetPixels } from '../pdf/export'

describe('grid', () => {
  it('fills the usable area with whole 5 mm squares', () => {
    expect(COLS).toBe(38)
    expect(ROWS).toBe(55)
    expect(AREA).toEqual({ x: 10, y: 11, w: 190, h: 275 })
  })
})

describe('pre-registered sizes', () => {
  it('A5: fits half an A5 page with 1.5 cm to spare', () => {
    expect(presetSize('3x2', 'a5')).toEqual({ w: 112.5, h: 75 })
    expect(presetSize('16x9', 'a5')).toEqual({ w: 118, h: 66.38 })
    expect(presetSize('1x1', 'a5')).toEqual({ w: 75, h: 75 })
    expect(presetSize('2x3', 'a5')).toEqual({ w: 50, h: 75 })
  })
  it('A6: takes up most of an A6 page', () => {
    expect(presetSize('3x2', 'a6')).toEqual({ w: 85, h: 56.67 })
    expect(presetSize('2x3', 'a6')).toEqual({ w: 85, h: 127.5 })
    expect(presetSize('16x9', 'a6')).toEqual({ w: 85, h: 47.81 })
    expect(presetSize('1x1', 'a6')).toEqual({ w: 85, h: 85 })
  })
})

describe('aspect ratio check', () => {
  it('accepts camera-exact ratios and rejects others', () => {
    expect(ratioMatches(6000, 4000, '3x2')).toBe(true)
    expect(ratioMatches(4000, 6000, '3x2')).toBe(false)
    expect(ratioMatches(4000, 6000, '2x3')).toBe(true)
    expect(ratioMatches(3840, 2160, '16x9')).toBe(true)
    expect(ratioMatches(4032, 3024, '3x2')).toBe(false)
    expect(ratioMatches(3000, 3000, '1x1')).toBe(true)
    expect(describeRatio(4032, 3024)).toBe('4×3')
  })
})

describe('placing and sizing', () => {
  it('snaps to the grid and stays inside the margins', () => {
    expect(snapPosition({ x: 12.4, y: 300, w: 60, h: 40 })).toEqual({ x: 10, y: 246, w: 60, h: 40 })
  })
  it('finds the next free spot', () => {
    expect(findSpot(60, 40, [])).toEqual({ x: 10, y: 11 })
    expect(findSpot(60, 40, [{ x: 10, y: 11, w: 60, h: 40 }])).toEqual({ x: 70, y: 11 })
    expect(findSpot(200, 40, [])).toBeNull()
  })
  it('resizes from a corner keeping the ratio and the opposite corner', () => {
    const r = resizeFromCorner({ x: 20, y: 21, w: 60, h: 40 }, 'se', { x: 112, y: 30 }, 1.5)
    expect(r).toEqual({ x: 20, y: 21, w: 90, h: 60 })
    const nw = resizeFromCorner({ x: 50, y: 51, w: 60, h: 40 }, 'nw', { x: 0, y: 0 }, 1.5)
    expect(nw.x + nw.w).toBe(110)
    expect(nw.y + nw.h).toBe(91)
    expect(nw.x).toBeGreaterThanOrEqual(10)
    expect(nw.y).toBeGreaterThanOrEqual(11)
  })
})

describe('print resolution', () => {
  it('resamples to 300 dpi, never above the photo', () => {
    expect(targetPixels({ w: 112.5, h: 75 }, { w: 6000, h: 4000 })).toEqual({ w: 1329, h: 886 })
    expect(targetPixels({ w: 112.5, h: 75 }, { w: 900, h: 600 })).toEqual({ w: 900, h: 600 })
  })
})
