import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { displaySize, orientationMatrix, parseJpeg } from './jpeg'
import { ddmmyy, pdfFileName, slugify } from '../app/files'
import { crc32 } from '../cull/zip'

const fixture = (n: string) => new Uint8Array(readFileSync(new URL(`./fixtures/${n}`, import.meta.url)))

describe('jpeg header', () => {
  it('reads size, orientation and colour profile', () => {
    const info = parseJpeg(fixture('fix_o8_icc.jpg'))!
    expect(info).toMatchObject({ width: 30, height: 20, components: 3, orientation: 8, progressive: false })
    expect(info.icc?.length).toBe(588)
    expect(displaySize(info)).toEqual({ w: 20, h: 30 })
  })
  it('handles plain and progressive files', () => {
    expect(parseJpeg(fixture('fix_plain.jpg'))).toMatchObject({ width: 30, height: 20, orientation: 1, icc: null })
    expect(parseJpeg(fixture('fix_prog.jpg'))).toMatchObject({ width: 30, height: 20, progressive: true })
    expect(parseJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull()
  })
  it('turns the unit square the way each orientation says', () => {
    // where the stored picture's top-left corner (u 0, v 1) ends up
    const tl = (o: number) => {
      const [a, b, c, d, e, f] = orientationMatrix(o)
      return [a * 0 + c * 1 + e, b * 0 + d * 1 + f]
    }
    expect(tl(1)).toEqual([0, 1])
    expect(tl(3)).toEqual([1, 0])
    expect(tl(6)).toEqual([1, 1]) // 90° clockwise: top-left goes top-right
    expect(tl(8)).toEqual([0, 0]) // 90° anticlockwise: top-left goes bottom-left
  })
})

describe('pdf file name', () => {
  it('is DDMMYY_custom-name.pdf', () => {
    const d = new Date(2026, 10, 16)
    expect(ddmmyy(d)).toBe('161126')
    expect(pdfFileName('Tenerife trip', d)).toBe('161126_tenerife-trip.pdf')
    expect(pdfFileName('  Café / Côte d’Azur — 2026!  ', d)).toBe('161126_cafe-cote-d-azur-2026.pdf')
    expect(pdfFileName('', d)).toBe('161126_foto-gns.pdf')
    expect(slugify('Notebook.pdf')).toBe('notebook')
  })
})

describe('zip', () => {
  it('computes standard CRC-32, also across chunks', () => {
    const b = new TextEncoder().encode('123456789')
    expect(crc32(b)).toBe(0xcbf43926)
    expect(crc32(b.subarray(4), crc32(b.subarray(0, 4)))).toBe(0xcbf43926)
  })
})
