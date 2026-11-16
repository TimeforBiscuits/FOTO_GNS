import { create } from 'zustand'
import type { Quality } from '../pdf/export'
import {
  clampToArea,
  findSpot,
  freeStartSize,
  presetSize,
  AREA,
  type RatioId,
  type Rect,
  type SizeId,
} from '../model/layout'

export interface Photo {
  assetId: string
  name: string
  pxW: number
  pxH: number
}

export interface Field extends Rect {
  id: string
  ratio: RatioId
  size: SizeId
  photo?: Photo
}

export interface Page {
  id: string
  fields: Field[]
}

export interface Asset {
  blob: Blob
  url: string
  w: number
  h: number
}

export interface Message {
  text: string
  tone: 'info' | 'alert'
  at: number
}

export interface Alert {
  title: string
  body: string
}

export interface DocState {
  pages: Page[]
  activePage: number
  selectedId: string | null
  ratio: RatioId
  fileName: string
  quality: Quality
  assets: Record<string, Asset>
  message: Message | null
  alert: Alert | null
  exporting: boolean
  /** A finished PDF waiting for a tap to open the share sheet (iPad). */
  ready: File | null

  setRatio: (r: RatioId) => void
  addField: (size: SizeId, at?: Rect) => void
  updateField: (id: string, patch: Partial<Field>) => void
  deleteField: (id: string) => void
  select: (id: string | null) => void
  attachPhoto: (fieldId: string, photo: Photo, asset: Asset) => void
  removePhoto: (fieldId: string) => void
  addPage: () => void
  deletePage: (index: number) => void
  setActivePage: (index: number) => void
  setFileName: (name: string) => void
  setQuality: (q: Quality) => void
  say: (text: string, tone?: Message['tone']) => void
  showAlert: (a: Alert | null) => void
  setExporting: (on: boolean) => void
  setReady: (f: File | null) => void
  load: (pages: Page[], assets: Record<string, Asset>, fileName: string, quality?: Quality) => void
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

const newPage = (): Page => ({ id: uid(), fields: [] })

const mapActive = (s: DocState, f: (p: Page) => Page) => s.pages.map((p, i) => (i === s.activePage ? f(p) : p))

export const useDoc = create<DocState>((set, get) => ({
  pages: [newPage()],
  activePage: 0,
  selectedId: null,
  ratio: '3x2',
  fileName: '',
  quality: 'original',
  assets: {},
  message: null,
  alert: null,
  exporting: false,
  ready: null,

  setRatio: (ratio) => set({ ratio }),

  addField: (size, at) => {
    const s = get()
    const ratio = s.ratio
    const dims = size === 'free' ? freeStartSize(ratio) : presetSize(ratio, size)
    const page = s.pages[s.activePage]
    let rect: Rect
    if (at) rect = at
    else {
      const spot = findSpot(dims.w, dims.h, page.fields)
      if (!spot) s.say('No room left on this page — it was placed on top. Move it, or add a page.', 'alert')
      rect = clampToArea({ x: spot?.x ?? AREA.x, y: spot?.y ?? AREA.y, ...dims })
    }
    const field: Field = { id: uid(), ratio, size, ...rect }
    set({ pages: mapActive(s, (p) => ({ ...p, fields: [...p.fields, field] })), selectedId: field.id })
  },

  updateField: (id, patch) =>
    set((s) => ({ pages: mapActive(s, (p) => ({ ...p, fields: p.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) })) })),

  deleteField: (id) =>
    set((s) => ({
      pages: s.pages.map((p) => ({ ...p, fields: p.fields.filter((f) => f.id !== id) })),
      selectedId: s.selectedId === id ? null : s.selectedId,
    })),

  select: (selectedId) => set({ selectedId }),

  attachPhoto: (fieldId, photo, asset) =>
    set((s) => ({
      assets: { ...s.assets, [photo.assetId]: asset },
      pages: s.pages.map((p) => ({ ...p, fields: p.fields.map((f) => (f.id === fieldId ? { ...f, photo } : f)) })),
    })),

  removePhoto: (fieldId) =>
    set((s) => ({ pages: s.pages.map((p) => ({ ...p, fields: p.fields.map((f) => (f.id === fieldId ? { ...f, photo: undefined } : f)) })) })),

  addPage: () => set((s) => ({ pages: [...s.pages, newPage()], activePage: s.pages.length, selectedId: null })),

  deletePage: (index) =>
    set((s) => {
      if (s.pages.length === 1) return { pages: [newPage()], activePage: 0, selectedId: null }
      const pages = s.pages.filter((_, i) => i !== index)
      return { pages, activePage: Math.min(s.activePage > index ? s.activePage - 1 : s.activePage, pages.length - 1), selectedId: null }
    }),

  setActivePage: (activePage) => set({ activePage, selectedId: null }),

  setFileName: (fileName) => set({ fileName }),

  setQuality: (quality) => set({ quality }),

  say: (text, tone = 'info') => set({ message: { text, tone, at: Date.now() } }),

  showAlert: (alert) => set({ alert }),

  setExporting: (exporting) => set({ exporting }),

  setReady: (ready) => set({ ready }),

  load: (pages, assets, fileName, quality = 'original') =>
    set({ pages: pages.length ? pages : [newPage()], assets, fileName, quality, activePage: 0, selectedId: null }),
}))

export const useActivePage = () => useDoc((s) => s.pages[s.activePage])

export const useSelectedField = () =>
  useDoc((s) => (s.selectedId ? (s.pages[s.activePage].fields.find((f) => f.id === s.selectedId) ?? null) : null))
