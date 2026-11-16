// Getting files out of the browser on each platform.

export const stamp = () => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

/** Make a typed name safe on Windows, macOS and iPadOS, without an extension. */
export const cleanFileName = (raw: string) =>
  raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.pdf$/i, '')
    .replace(/^[\s.]+|[\s.]+$/g, '')
    .slice(0, 100)

/** Turn a typed name into a file-name slug: "Tenerife trip" → "tenerife-trip". */
export const slugify = (raw: string) =>
  raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\.pdf$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)

/** DDMMYY, e.g. 161126 for 16 November 2026. */
export const ddmmyy = (d = new Date()) => [d.getDate(), d.getMonth() + 1, d.getFullYear() % 100].map((n) => String(n).padStart(2, '0')).join('')

/** The PDF's name: DDMMYY_custom-name.pdf, dated the day it's exported. */
export const pdfFileName = (custom: string, d = new Date()) => `${ddmmyy(d)}_${slugify(custom) || 'foto-gns'}.pdf`

/** The file's base name: the project's name, or a dated default. */
export const baseName = (name: string | undefined) => cleanFileName(name ?? '') || `FOTO_GNS-${stamp()}`

export interface Writable {
  createWritable: () => Promise<{ write: (d: Blob) => Promise<void>; close: () => Promise<void> }>
}

interface SaveFilePickerWindow {
  showSaveFilePicker?: (opts: unknown) => Promise<Writable>
}

/** Chrome and Edge can ask where to save (must be called straight from a click). */
export const canPickSaveLocation = () => typeof (window as SaveFilePickerWindow).showSaveFilePicker === 'function'

export const pickSaveLocation = (name: string, description: string, accept: Record<string, string[]>) =>
  (window as SaveFilePickerWindow).showSaveFilePicker!({ suggestedName: name, types: [{ description, accept }] })

export async function writeTo(handle: Writable, file: Blob) {
  const out = await handle.createWritable()
  await out.write(file)
  await out.close()
}

/** Hand a finished file to the user: the share sheet on iPad (Save to Files), a download elsewhere. */
export async function deliver(file: File) {
  const touch = navigator.maxTouchPoints > 1
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name })
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
