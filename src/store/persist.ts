// Work saves itself in the browser: the layout as JSON, each photo as its
// own blob. Photos never leave the device.

import { del, get, keys, set } from 'idb-keyval'
import { downscale } from '../cull/previews'
import type { Quality } from '../pdf/export'
import { useDoc, type Asset, type Page } from './doc'

const DOC_KEY = 'foto-gns:doc'
const assetKey = (id: string) => `foto-gns:asset:${id}`

interface Saved {
  v: 1
  pages: Page[]
  fileName: string
  quality?: Quality
}

/** Bring back the last session. Resolves true if there was one with something in it. */
export async function restore(): Promise<boolean> {
  try {
    const saved = (await get(DOC_KEY)) as Saved | undefined
    if (!saved || saved.v !== 1) return false
    const ids = new Set(saved.pages.flatMap((p) => p.fields.map((f) => f.photo?.assetId).filter((x): x is string => !!x)))
    const assets: Record<string, Asset> = {}
    for (const id of ids) {
      const rec = (await get(assetKey(id))) as { blob: Blob; w: number; h: number } | undefined
      if (rec) assets[id] = { ...rec, url: await downscale(rec.blob, 2000, 0.9).then((r) => r.url, () => URL.createObjectURL(rec.blob)) }
    }
    // A photo whose blob went missing leaves its field empty rather than broken.
    const pages = saved.pages.map((p) => ({
      ...p,
      fields: p.fields.map((f) => (f.photo && !assets[f.photo.assetId] ? { ...f, photo: undefined } : f)),
    }))
    useDoc.getState().load(pages, assets, saved.fileName ?? '', saved.quality ?? 'original')
    return pages.some((p) => p.fields.length > 0)
  } catch {
    // Private browsing or blocked storage: start fresh.
    return false
  }
}

let timer: ReturnType<typeof setTimeout> | undefined
const savedAssets = new Set<string>()

async function save() {
  const s = useDoc.getState()
  try {
    const used = new Set<string>()
    for (const p of s.pages) for (const f of p.fields) if (f.photo) used.add(f.photo.assetId)
    for (const id of used) {
      if (savedAssets.has(id)) continue
      const a = s.assets[id]
      if (!a) continue
      await set(assetKey(id), { blob: a.blob, w: a.w, h: a.h })
      savedAssets.add(id)
    }
    await set(DOC_KEY, { v: 1, pages: s.pages, fileName: s.fileName, quality: s.quality } satisfies Saved)
    // Drop photos no field uses any more.
    for (const k of await keys()) {
      const key = String(k)
      if (!key.startsWith('foto-gns:asset:')) continue
      const id = key.slice('foto-gns:asset:'.length)
      if (!used.has(id)) {
        await del(key)
        savedAssets.delete(id)
      }
    }
  } catch {
    // Storage full or unavailable; the session still works.
  }
}

export function startAutosave() {
  // Anything already in storage when we start counts as saved.
  for (const p of useDoc.getState().pages) for (const f of p.fields) if (f.photo) savedAssets.add(f.photo.assetId)
  useDoc.subscribe((s, prev) => {
    if (s.pages === prev.pages && s.fileName === prev.fileName && s.quality === prev.quality) return
    clearTimeout(timer)
    timer = setTimeout(save, 400)
  })
}
