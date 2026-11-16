// Low-resolution previews, so hundreds of full-size JPGs stay quick to browse.
// Thumbnails are built in the background, nearest the current photo first;
// the big loupe preview is built on demand and only a few are kept.

import { useEffect, useState } from 'react'
import { decode, drawUpright } from '../app/decode'
import { useCull, type CullItem } from '../store/cull'

const IOS = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1 && /Mac|iPad|iPhone/.test(navigator.userAgent)

const THUMB_EDGE = 360
const LOUPE_EDGE = 2400

/** Decode the right way up and shrink to a JPEG whose long edge is at most `edge`. */
export async function downscale(file: Blob, edge: number, quality: number) {
  const d = await decode(file)
  try {
    const k = Math.min(1, edge / Math.max(d.w, d.h))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(d.w * k))
    canvas.height = Math.max(1, Math.round(d.h * k))
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    drawUpright(ctx, d, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', quality))
    canvas.width = canvas.height = 0
    if (!blob) throw new Error('encode')
    return { url: URL.createObjectURL(blob), w: d.w, h: d.h }
  } finally {
    d.close()
  }
}

// ── thumbnails ──

let running = 0
const busy = new Set<number>()

/** Pick the photo without a thumbnail nearest the current one. */
function nextWanted(items: CullItem[], index: number) {
  for (let d = 0; d < items.length; d++) {
    for (const i of d ? [index + d, index - d] : [index]) {
      const it = items[i]
      if (it && !it.thumb && !it.broken && !busy.has(it.id)) return it
    }
  }
  return null
}

export function pumpThumbs() {
  const limit = IOS ? 1 : 3
  while (running < limit) {
    const s = useCull.getState()
    const it = nextWanted(s.items, s.index)
    if (!it) return
    running++
    busy.add(it.id)
    const file = it.file
    downscale(file, THUMB_EDGE, 0.8)
      .then(({ url, w, h }) => {
        // The folder may have been closed or replaced meanwhile.
        if (useCull.getState().items[it.id]?.file !== file) return URL.revokeObjectURL(url)
        useCull.getState().patchItem(it.id, { thumb: url, w, h })
      })
      .catch(() => {
        if (useCull.getState().items[it.id]?.file === file) useCull.getState().patchItem(it.id, { broken: true })
      })
      .finally(() => {
        running--
        busy.delete(it.id)
        pumpThumbs()
      })
  }
}

// Start again whenever a new folder opens or the current photo jumps.
useCull.subscribe((s, prev) => {
  if (s.items !== prev.items && s.items.length !== prev.items.length) busy.clear()
  if (s.items.length && (s.items !== prev.items || s.index !== prev.index)) pumpThumbs()
})

// ── loupe previews ──

const cache = new Map<File, Promise<string>>()
const order: File[] = []
const KEEP = IOS ? 5 : 12

function loupeUrl(file: File) {
  let p = cache.get(file)
  if (p) {
    order.splice(order.indexOf(file), 1)
    order.push(file)
    return p
  }
  p = downscale(file, LOUPE_EDGE, 0.88).then((r) => r.url)
  cache.set(file, p)
  order.push(file)
  while (order.length > KEEP) {
    const old = order.shift()!
    cache.get(old)?.then((u) => URL.revokeObjectURL(u), () => undefined)
    cache.delete(old)
  }
  return p
}

/** The big preview for one photo, plus a quiet head start on its neighbours. */
export function useLoupe(item: CullItem | undefined, neighbours: (CullItem | undefined)[]) {
  const [state, setState] = useState<{ file: File; url: string } | null>(null)
  useEffect(() => {
    if (!item) return
    let live = true
    loupeUrl(item.file).then(
      (url) => live && setState({ file: item.file, url }),
      () => undefined,
    )
    const t = setTimeout(() => neighbours.forEach((n) => n && !n.broken && void loupeUrl(n.file).catch(() => undefined)), 150)
    return () => {
      live = false
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.file])
  return state && item && state.file === item.file ? state.url : null
}

export function clearLoupeCache() {
  for (const p of cache.values()) p.then((u) => URL.revokeObjectURL(u), () => undefined)
  cache.clear()
  order.length = 0
}
