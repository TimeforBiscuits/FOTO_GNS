import { baseName, canPickSaveLocation, deliver, pickSaveLocation, writeTo, type Writable } from '../app/files'
import { A4, MM_PER_INCH, PRINT_DPI, type Rect } from '../model/layout'
import { useDoc, type Asset } from '../store/doc'

const PT_PER_MM = 72 / MM_PER_INCH

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('A photo could not be decoded for the PDF.'))
    img.src = url
  })

/** Pixels a field needs at the print resolution — never more than the photo has. */
export function targetPixels(field: { w: number; h: number }, src: { w: number; h: number }) {
  const want = { w: Math.round((field.w / MM_PER_INCH) * PRINT_DPI), h: Math.round((field.h / MM_PER_INCH) * PRINT_DPI) }
  const k = Math.min(1, src.w / want.w, src.h / want.h)
  return { w: Math.max(1, Math.round(want.w * k)), h: Math.max(1, Math.round(want.h * k)) }
}

/** Resample a photo to the field at 300 dpi, trimming the hair of difference the ratio check allows. */
async function rasterize(field: Rect, asset: Asset) {
  const img = await loadImage(asset.url)
  const t = targetPixels(field, { w: img.naturalWidth, h: img.naturalHeight })
  const canvas = document.createElement('canvas')
  canvas.width = t.w
  canvas.height = t.h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Out of memory preparing a photo.')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, t.w, t.h)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  const s = Math.max(t.w / img.naturalWidth, t.h / img.naturalHeight)
  const dw = img.naturalWidth * s
  const dh = img.naturalHeight * s
  ctx.drawImage(img, (t.w - dw) / 2, (t.h - dh) / 2, dw, dh)
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.95))
  canvas.width = canvas.height = 0
  if (!blob) throw new Error('Out of memory writing a photo.')
  return new Uint8Array(await blob.arrayBuffer())
}

export async function buildPdf(): Promise<Uint8Array> {
  const { pages, assets } = useDoc.getState()
  const { PDFDocument } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  pdf.setTitle('FOTO_GNS photo sheet')
  pdf.setCreator('FOTO_GNS')
  pdf.setProducer('FOTO_GNS')
  const W = A4.w * PT_PER_MM
  const H = A4.h * PT_PER_MM
  for (const page of pages) {
    const p = pdf.addPage([W, H])
    for (const f of page.fields) {
      const asset = f.photo && assets[f.photo.assetId]
      if (!asset) continue
      const jpg = await pdf.embedJpg(await rasterize(f, asset))
      p.drawImage(jpg, { x: f.x * PT_PER_MM, y: H - (f.y + f.h) * PT_PER_MM, width: f.w * PT_PER_MM, height: f.h * PT_PER_MM })
    }
  }
  return pdf.save()
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
  const name = `${baseName(s.fileName)}.pdf`

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
    const bytes = await buildPdf()
    const file = new File([bytes as BlobPart], name, { type: 'application/pdf' })
    if (handle) await writeTo(handle, file)
    else if (navigator.maxTouchPoints > 1) {
      // iPad: building took a moment, so the share sheet needs a fresh tap.
      s.setReady(file)
      return
    } else await deliver(file)
    s.say(`${name} — ${s.pages.length} page${s.pages.length > 1 ? 's' : ''}, ${filled} photo${filled > 1 ? 's' : ''} at ${PRINT_DPI} dpi`)
  } catch (e) {
    s.showAlert({ title: 'Export failed', body: (e as Error).message || 'The PDF could not be written.' })
  } finally {
    s.setExporting(false)
  }
}
