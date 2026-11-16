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
  /** The original file, untouched. */
  blob: Blob
  /** An upright, screen-sized copy for the sheet. */
  preview?: Blob
  url: string
  w: number
  h: number
}

/** A project: a named set of A4 pages. */
export interface Project {
  id: string
  name: string
  pages: Page[]
  quality: Quality
  created: number
  updated: number
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
  /** The open project. Its pages, name and quality are the live fields below. */
  projectId: string
  /** Every project, newest first. The open one's entry is refreshed on save and switch. */
  projects: Project[]
  pages: Page[]
  activePage: number
  selectedId: string | null
  ratio: RatioId
  projectName: string
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
  setProjectName: (name: string) => void
  setQuality: (q: Quality) => void
  say: (text: string, tone?: Message['tone']) => void
  showAlert: (a: Alert | null) => void
  setExporting: (on: boolean) => void
  setReady: (f: File | null) => void
  /** Open a project (its photos already loaded), replacing what's on screen. */
  openProject: (project: Project, assets: Record<string, Asset>, projects: Project[]) => void
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

const newPage = (): Page => ({ id: uid(), fields: [] })

export const newProject = (name = ''): Project => {
  const now = Date.now()
  return { id: uid(), name, pages: [newPage()], quality: 'original', created: now, updated: now }
}

/** The open project as it stands now, from the live fields. */
export const currentProject = (s: DocState): Project => {
  const stored = s.projects.find((p) => p.id === s.projectId)
  return {
    id: s.projectId,
    name: s.projectName,
    pages: s.pages,
    quality: s.quality,
    created: stored?.created ?? Date.now(),
    updated: stored?.updated ?? Date.now(),
  }
}

/** All projects, with the open one up to date. */
export const allProjects = (s: DocState): Project[] => s.projects.map((p) => (p.id === s.projectId ? { ...currentProject(s), updated: p.updated } : p))

const first = newProject()

const mapActive = (s: DocState, f: (p: Page) => Page) => s.pages.map((p, i) => (i === s.activePage ? f(p) : p))

export const useDoc = create<DocState>((set, get) => ({
  projectId: first.id,
  projects: [first],
  pages: first.pages,
  activePage: 0,
  selectedId: null,
  ratio: '3x2',
  projectName: '',
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

  setProjectName: (projectName) => set({ projectName }),

  setQuality: (quality) => set({ quality }),

  say: (text, tone = 'info') => set({ message: { text, tone, at: Date.now() } }),

  showAlert: (alert) => set({ alert }),

  setExporting: (exporting) => set({ exporting }),

  setReady: (ready) => set({ ready }),

  openProject: (project, assets, projects) =>
    set({
      projectId: project.id,
      projects,
      pages: project.pages.length ? project.pages : [newPage()],
      projectName: project.name,
      quality: project.quality,
      assets,
      activePage: 0,
      selectedId: null,
    }),
}))

export const useActivePage = () => useDoc((s) => s.pages[s.activePage])

export const useSelectedField = () =>
  useDoc((s) => (s.selectedId ? (s.pages[s.activePage].fields.find((f) => f.id === s.selectedId) ?? null) : null))
