// Decoding photos the right way up on every browser.
//
// Cameras store most portrait photos sideways and add an EXIF tag saying
// "turn me". Some browsers apply that tag when decoding and some don't
// (Safari has varied by version and by API), so we test once with a tiny
// sideways JPEG and turn pictures ourselves only when the browser won't.

import { readJpegInfo, swapsAxes } from '../model/jpeg'

/** A 2 × 1 white JPEG tagged orientation 6: decoded upright it is 1 × 2. */
const PROBE =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/4QAiRXhpZgAATU0AKgAAAAgAAQESAAMAAAABAAYAAAAAAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAABAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD0CiiigD//2Q=='

const probeBlob = () => new Blob([Uint8Array.from(atob(PROBE), (c) => c.charCodeAt(0))], { type: 'image/jpeg' })

const bitmapOpts = { imageOrientation: 'from-image' } as ImageBitmapOptions

const bitmap = (blob: Blob) => createImageBitmap(blob, bitmapOpts).catch(() => createImageBitmap(blob))

const loadImg = (blob: Blob) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      resolve(img)
      setTimeout(() => URL.revokeObjectURL(url), 0)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('decode'))
    }
    img.src = url
  })

const hasBitmap = () => typeof createImageBitmap === 'function'

let honours: Promise<boolean> | null = null
/** Does this browser's decoder already turn pictures by their EXIF tag? */
function decoderHonoursExif() {
  honours ??= (async () => {
    try {
      if (hasBitmap()) {
        const b = await bitmap(probeBlob())
        const ok = b.width === 1
        b.close()
        return ok
      }
      return (await loadImg(probeBlob())).naturalWidth === 1
    } catch {
      return true
    }
  })()
  return honours
}

export interface Decoded {
  source: CanvasImageSource
  /** Size as decoded. */
  rawW: number
  rawH: number
  /** The EXIF turn still to apply when drawing (1 = none). */
  orientation: number
  /** Size the right way up. */
  w: number
  h: number
  close: () => void
}

export async function decode(blob: Blob): Promise<Decoded> {
  let source: CanvasImageSource
  let rawW: number
  let rawH: number
  let close = () => {}
  if (hasBitmap()) {
    const b = await bitmap(blob)
    source = b
    rawW = b.width
    rawH = b.height
    close = () => b.close()
  } else {
    const img = await loadImg(blob)
    source = img
    rawW = img.naturalWidth
    rawH = img.naturalHeight
  }
  let orientation = 1
  if (!(await decoderHonoursExif())) {
    const info = await readJpegInfo(blob).catch(() => null)
    if (info) orientation = info.orientation
  }
  const swap = swapsAxes(orientation)
  return { source, rawW, rawH, orientation, w: swap ? rawH : rawW, h: swap ? rawW : rawH, close }
}

/**
 * Draw a decoded picture the right way up so it fills (dx, dy, dw, dh) —
 * a box in the upright picture's shape.
 */
export function drawUpright(ctx: CanvasRenderingContext2D, d: Decoded, dx: number, dy: number, dw: number, dh: number) {
  ctx.save()
  ctx.translate(dx, dy)
  switch (d.orientation) {
    case 2:
      ctx.transform(-1, 0, 0, 1, dw, 0)
      break
    case 3:
      ctx.transform(-1, 0, 0, -1, dw, dh)
      break
    case 4:
      ctx.transform(1, 0, 0, -1, 0, dh)
      break
    case 5:
      ctx.transform(0, 1, 1, 0, 0, 0)
      break
    case 6:
      ctx.transform(0, 1, -1, 0, dw, 0)
      break
    case 7:
      ctx.transform(0, -1, -1, 0, dw, dh)
      break
    case 8:
      ctx.transform(0, -1, 1, 0, 0, dh)
      break
  }
  const swap = swapsAxes(d.orientation)
  ctx.drawImage(d.source, 0, 0, swap ? dh : dw, swap ? dw : dh)
  ctx.restore()
}

/** The picture's upright size, without keeping it decoded. */
export async function measureUpright(blob: Blob) {
  const d = await decode(blob)
  d.close()
  return { w: d.w, h: d.h }
}
