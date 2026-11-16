import { describeRatio, RATIOS, ratioMatches } from '../model/layout'
import { downscale } from '../cull/previews'
import { uid, useDoc, type Field } from '../store/doc'

/** Open the platform's file dialogue. Must be called straight from a tap or click. */
function pickImage(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.style.display = 'none'
    input.addEventListener('change', () => {
      resolve(input.files?.[0] ?? null)
      input.remove()
    })
    input.addEventListener('cancel', () => {
      resolve(null)
      input.remove()
    })
    document.body.appendChild(input)
    input.click()
  })
}

/**
 * The picture's upright size, plus a screen-sized upright preview for the
 * sheet. The original file is kept untouched for the PDF.
 */
export const measure = (blob: Blob) => downscale(blob, 2000, 0.9)

export async function attachTo(field: Field) {
  const file = await pickImage()
  if (!file) return
  const { showAlert, attachPhoto, say } = useDoc.getState()

  let m: { w: number; h: number; url: string; blob: Blob }
  try {
    m = await measure(file)
  } catch {
    showAlert({
      title: 'Picture not readable',
      body: `“${file.name}” could not be opened as a picture on this device. Try a JPEG or PNG copy.`,
    })
    return
  }

  if (!ratioMatches(m.w, m.h, field.ratio)) {
    URL.revokeObjectURL(m.url)
    showAlert({
      title: 'Wrong aspect ratio',
      body: `This field is ${RATIOS[field.ratio].label}, but “${file.name}” is ${describeRatio(m.w, m.h)} (${m.w} × ${m.h} px). Choose a ${RATIOS[field.ratio].label} photo, or make a field that matches it.`,
    })
    return
  }

  const assetId = uid()
  attachPhoto(field.id, { assetId, name: file.name, pxW: m.w, pxH: m.h }, { blob: file, preview: m.blob, url: m.url, w: m.w, h: m.h })
  say(`${file.name} placed`)
}
