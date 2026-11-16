// Curation: comb through a folder of JPGs and pick the keepers (selezioni).
// Originals are only ever read; nothing here deletes or changes them.

import { get, set } from 'idb-keyval'
import { create } from 'zustand'

export interface CullItem {
  id: number
  file: File
  name: string
  /** Identifies the same file again in a later session. */
  key: string
  thumb?: string
  w?: number
  h?: number
  broken?: boolean
}

export type CullMode = 'loupe' | 'grid'
export type CullFilter = 'all' | 'keep' | 'reject'

interface CullState {
  items: CullItem[]
  source: string
  index: number
  keep: Record<number, true>
  seen: Record<number, true>
  mode: CullMode
  filter: CullFilter
  autoAdvance: boolean
  exported: boolean

  open: (files: File[], source: string) => Promise<void>
  close: () => void
  go: (index: number) => void
  step: (dir: 1 | -1) => void
  setKeep: (id: number, on: boolean) => void
  setMode: (m: CullMode) => void
  setFilter: (f: CullFilter) => void
  setAutoAdvance: (on: boolean) => void
  patchItem: (id: number, patch: Partial<CullItem>) => void
  setExported: (on: boolean) => void
  clearKeep: () => void
}

const MARKS = 'foto-gns:cull-marks'
const fileKey = (f: File) => `${f.name}|${f.size}|${f.lastModified}`

export const isJpeg = (f: File) => /\.jpe?g$/i.test(f.name) || f.type === 'image/jpeg'

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

/** The items the current filter shows, in order. */
export const visibleItems = (s: Pick<CullState, 'items' | 'keep' | 'filter'>) =>
  s.filter === 'all' ? s.items : s.items.filter((it) => !!s.keep[it.id] === (s.filter === 'keep'))

let saveTimer: ReturnType<typeof setTimeout> | undefined
/** Remember keepers by file, so reopening the same folder brings the marks back. */
function saveMarks() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    const s = useCull.getState()
    try {
      const all = ((await get(MARKS)) as Record<string, 1> | undefined) ?? {}
      for (const it of s.items) {
        if (s.keep[it.id]) all[it.key] = 1
        else delete all[it.key]
      }
      await set(MARKS, all)
    } catch {
      // storage unavailable: marks last for this session only
    }
  }, 300)
}

export const useCull = create<CullState>((setState, getState) => ({
  items: [],
  source: '',
  index: 0,
  keep: {},
  seen: {},
  mode: 'loupe',
  filter: 'all',
  autoAdvance: true,
  exported: false,

  open: async (files, source) => {
    getState().close()
    const jpgs = files.filter(isJpeg).sort((a, b) => collator.compare(a.webkitRelativePath || a.name, b.webkitRelativePath || b.name))
    const items: CullItem[] = jpgs.map((file, id) => ({ id, file, name: file.name, key: fileKey(file) }))
    let marks: Record<string, 1> = {}
    try {
      marks = ((await get(MARKS)) as Record<string, 1> | undefined) ?? {}
    } catch {
      // no stored marks
    }
    const keep: Record<number, true> = {}
    for (const it of items) if (marks[it.key]) keep[it.id] = true
    setState({ items, source, index: 0, keep, seen: items.length ? { 0: true } : {}, mode: 'loupe', filter: 'all', exported: false })
  },

  close: () => {
    for (const it of getState().items) if (it.thumb) URL.revokeObjectURL(it.thumb)
    setState({ items: [], source: '', index: 0, keep: {}, seen: {}, exported: false })
  },

  go: (index) => {
    const s = getState()
    if (index < 0 || index >= s.items.length) return
    setState({ index, seen: s.seen[index] ? s.seen : { ...s.seen, [index]: true } })
  },

  step: (dir) => {
    const s = getState()
    const vis = visibleItems(s)
    if (!vis.length) return
    const pos = vis.findIndex((it) => it.id === s.index)
    // Not in the filtered list (e.g. just un-kept under "keepers"): move to the nearest one in that direction.
    const next =
      pos < 0 ? (dir > 0 ? vis.find((it) => it.id > s.index) : [...vis].reverse().find((it) => it.id < s.index)) : vis[pos + dir]
    if (next) s.go(next.id)
  },

  setKeep: (id, on) => {
    const s = getState()
    if (!!s.keep[id] === on) return
    const keep = { ...s.keep }
    if (on) keep[id] = true
    else delete keep[id]
    setState({ keep, exported: false })
    saveMarks()
  },

  setMode: (mode) => setState({ mode }),
  setFilter: (filter) => setState({ filter }),
  setAutoAdvance: (autoAdvance) => setState({ autoAdvance }),
  patchItem: (id, patch) => setState((s) => ({ items: s.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) })),
  setExported: (exported) => setState({ exported }),
  clearKeep: () => {
    setState({ keep: {}, exported: false })
    saveMarks()
  },
}))

export const keepCount = (keep: Record<number, true>) => Object.keys(keep).length

/** Mark (or unmark) the current photo, then move on if auto-advance is on. */
export function decide(on: boolean) {
  const s = useCull.getState()
  const it = s.items[s.index]
  if (!it) return
  s.setKeep(it.id, on)
  if (s.autoAdvance) s.step(1)
}

export function toggleCurrent() {
  const s = useCull.getState()
  const it = s.items[s.index]
  if (it) s.setKeep(it.id, !s.keep[it.id])
}

// Leaving with unsaved selezioni asks first.
if (typeof window !== 'undefined')
  window.addEventListener('beforeunload', (e) => {
    const s = useCull.getState()
    if (keepCount(s.keep) && !s.exported) e.preventDefault()
  })
