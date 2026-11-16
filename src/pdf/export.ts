// Building the print PDF.
//
// Two qualities:
//  · "original" (default): each JPEG goes into the PDF byte for byte, at the
//    camera's full resolution, never decoded or re-compressed, with its own
//    colour profile. Turning it upright and trimming the hair of difference
//    the ratio check allows are done by the PDF itself (a transform and a
//    clip), so not one pixel changes. PNGs go in losslessly; other formats
//    (HEIC, WebP) are converted once at full resolution, JPEG quality 100.
//  · "print300": each photo resampled to exactly 300 dpi at its printed size,
//    JPEG quality 95. Much smaller files.

import type { PDFDocument, PDFImage, PDFPage } from 'pdf-lib'
import { canPickSaveLocation, deliver, pdfFileName, pickSaveLocation, writeTo, type Writable } from '../app/files'
import { decode, drawUpright } from '../app/decode'
import { A4, MM_PER_INCH, PRINT_DPI, type Rect } from '../model/layout'
import { displaySize, orientationMatrix, parseJpeg, type JpegInfo } from '../model/jpeg'
import { useDoc, type Asset, type Field } from '../store/doc'

export type Quality = 'original' | 'print300'

const PT_PER_MM = 72 / MM_PER_INCH

/** iPad Safari refuses canvases over 16.7 megapixels. */
const maxCanvasPixels = () => (navigator.maxTouchPoints > 1 ? 16_000_000 : 64_000_000)

/** Pixels a field needs at the print resolution — never more than the photo has. */
export function targetPixels(field: { w: number; h: number }, src: { w: number; h: number }) {
  const want = { w: Math.round((field.w / MM_PER_INCH) * PRINT_DPI), h: Math.round((field.h / MM_PER_INCH) * PRINT_DPI) }
  const k = Math.min(1, src.w / want.w, src.h / want.h)
  return { w: Math.max(1, Math.round(want.w * k)), h: Math.max(1, Math.round(want.h * k)) }
}

const toJpeg = async (canvas: HTMLCanvasElement, q: number) => {
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', q))
  canvas.width = canvas.height = 0
  if (!blob) throw new Error('Out of memory writing a photo.')
  return new Uint8Array(await blob.arrayBuffer())
}

/** Compact: resample to the field at 300 dpi, cropped to it. */
async function rasterize300(field: Rect, blob: Blob) {
  const d = await decode(blob)
  try {
    const t = targetPixels(field, d)
    const canvas = document.createElement('canvas')
    canvas.width = t.w
    canvas.height = t.h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Out of memory preparing a photo.')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, t.w, t.h)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    const s = Math.max(t.w / d.w, t.h / d.h)
    drawUpright(ctx, d, (t.w - d.w * s) / 2, (t.h - d.h * s) / 2, d.w * s, d.h * s)
    return toJpeg(canvas, 0.95)
  } finally {
    d.close()
  }
}

/** For formats a PDF can't hold as they are: convert once, upright, at full resolution. */
async function convertFull(blob: Blob) {
  const d = await decode(blob)
  try {
    const k = Math.min(1, Math.sqrt(maxCanvasPixels() / (d.w * d.h)))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(d.w * k)
    canvas.height = Math.round(d.h * k)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Out of memory preparing a photo.')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    drawUpright(ctx, d, 0, 0, canvas.width, canvas.height)
    return toJpeg(canvas, 1)
  } finally {
    d.close()
  }
}

/** An embedded picture, how big it is upright, and how to turn it upright. */
interface Placed {
  image: PDFImage
  w: number
  h: number
  orientation: number
}

/** Give the image its own colour profile, so Adobe RGB / Display P3 photos print true. */
async function attachIcc(pdf: PDFDocument, image: PDFImage, info: JpegInfo) {
  const { PDFName, PDFRawStream } = await import('pdf-lib')
  if (!info.icc || info.icc.length < 128) return
  const space = String.fromCharCode(...info.icc.subarray(16, 20))
  const n = space === 'RGB ' ? 3 : space === 'GRAY' ? 1 : 0
  if (!n || n !== info.components) return
  await image.embed()
  const obj = pdf.context.lookup(image.ref)
  if (!(obj instanceof PDFRawStream)) return
  const icc = pdf.context.register(pdf.context.flateStream(info.icc, { N: n, Alternate: n === 3 ? 'DeviceRGB' : 'DeviceGray' }))
  obj.dict.set(PDFName.of('ColorSpace'), pdf.context.obj([PDFName.of('ICCBased'), icc]))
}

async function embedOriginal(pdf: PDFDocument, asset: Asset): Promise<Placed> {
  const bytes = new Uint8Array(await asset.blob.arrayBuffer())
  const info = parseJpeg(bytes)
  if (info && (info.components === 3 || info.components === 1)) {
    const image = await pdf.embedJpg(bytes)
    await attachIcc(pdf, image, info)
    const up = displaySize(info)
    return { image, w: up.w, h: up.h, orientation: info.orientation }
  }
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    const image = await pdf.embedPng(bytes)
    return { image, w: image.width, h: image.height, orientation: 1 }
  }
  const image = await pdf.embedJpg(await convertFull(asset.blob))
  return { image, w: image.width, h: image.height, orientation: 1 }
}

/** Draw a picture so it covers the field, turned upright, clipped to the field's edges. */
async function place(page: PDFPage, placed: Placed, f: Field) {
  const lib = await import('pdf-lib')
  const H = A4.h * PT_PER_MM
  const fx = f.x * PT_PER_MM
  const fy = H - (f.y + f.h) * PT_PER_MM
  const fw = f.w * PT_PER_MM
  const fh = f.h * PT_PER_MM
  const k = Math.max(fw / placed.w, fh / placed.h)
  const dw = placed.w * k
  const dh = placed.h * k
  const x0 = fx + (fw - dw) / 2
  const y0 = fy + (fh - dh) / 2
  const [a, b, c, d, e, g] = orientationMatrix(placed.orientation)
  const name = page.node.newXObject('Foto', placed.image.ref)
  page.pushOperators(
    lib.pushGraphicsState(),
    lib.rectangle(fx, fy, fw, fh),
    lib.clip(),
    lib.endPath(),
    lib.concatTransformationMatrix(a * dw, b * dh, c * dw, d * dh, e * dw + x0, g * dh + y0),
    lib.drawObject(name),
    lib.popGraphicsState(),
  )
}

export async function buildPdf(quality: Quality, onProgress?: (done: number, total: number) => void): Promise<Uint8Array> {
  const { pages, assets } = useDoc.getState()
  const { PDFDocument } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  pdf.setTitle('FOTO_GNS photo sheet')
  pdf.setCreator('FOTO_GNS')
  pdf.setProducer('FOTO_GNS')
  const total = pages.reduce((n, p) => n + p.fields.filter((f) => f.photo && assets[f.photo.assetId]).length, 0)
  let done = 0
  // A photo used in several fields goes into the file once.
  const originals = new Map<string, Placed>()
  for (const page of pages) {
    const p = pdf.addPage([A4.w * PT_PER_MM, A4.h * PT_PER_MM])
    for (const f of page.fields) {
      const asset = f.photo && assets[f.photo.assetId]
      if (!asset || !f.photo) continue
      onProgress?.(done++, total)
      if (quality === 'original') {
        let placed = originals.get(f.photo.assetId)
        if (!placed) {
          placed = await embedOriginal(pdf, asset)
          originals.set(f.photo.assetId, placed)
        }
        await place(p, placed, f)
      } else {
        const image = await pdf.embedJpg(await rasterize300(f, asset.blob))
        await place(p, { image, w: image.width, h: image.height, orientation: 1 }, f)
      }
    }
  }
  onProgress?.(total, total)
  return pdf.save({ useObjectStreams: false })
}

/** Rough size of the PDF, for the panel. */
export function estimateBytes(quality: Quality) {
  const { pages, assets } = useDoc.getState()
  let n = 0
  const seen = new Set<string>()
  for (const p of pages)
    for (const f of p.fields) {
      const a = f.photo && assets[f.photo.assetId]
      if (!a || !f.photo) continue
      if (quality === 'original') {
        if (!seen.has(f.photo.assetId)) n += a.blob.size
        seen.add(f.photo.assetId)
      } else {
        const t = targetPixels(f, { w: a.w, h: a.h })
        n += t.w * t.h * 0.33
      }
    }
  return n
}

/** Ask where to save (where the browser can), build the PDF, hand it over. */
export async function exportPdf() {
  const s = useDoc.getState()
  if (s.exporting) return
  const filled = s.pages.reduce((n, p) => n + p.fields.filter((f) => f.photo).length, 0)
  if (!filled) {
    s.showAlert({ title: 'Nothing to print', body: 'Attach a photo to at least one field first. Empty fields are left out of the PDF.' })
    return
  }
  const name = pdfFileName(s.fileName)

  // Chrome and Edge ask for a location first, while the click still counts.
  let handle: Writable | null = null
  if (canPickSaveLocation()) {
    try {
      handle = await pickSaveLocation(name, 'PDF document', { 'application/pdf': ['.pdf'] })
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
  }

  s.setExporting(true)
  try {
    const bytes = await buildPdf(s.quality)
    const file = new File([bytes as BlobPart], name, { type: 'application/pdf' })
    if (handle) await writeTo(handle, file)
    else if (navigator.maxTouchPoints > 1) {
      // iPad: building took a moment, so the share sheet needs a fresh tap.
      s.setReady(file)
      return
    } else await deliver(file)
    const mb = (file.size / 1024 / 1024).toFixed(1)
    s.say(`${name} — ${s.pages.length} page${s.pages.length > 1 ? 's' : ''}, ${filled} photo${filled > 1 ? 's' : ''}, ${mb} MB, ${s.quality === 'original' ? 'original quality' : `${PRINT_DPI} dpi`}`)
  } catch (e) {
    s.showAlert({ title: 'Export failed', body: (e as Error).message || 'The PDF could not be written.' })
  } finally {
    s.setExporting(false)
  }
}
