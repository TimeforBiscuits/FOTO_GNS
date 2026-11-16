// Work saves itself in the browser: every project's layout as JSON, each
// photo as its own blob. Photos never leave the device.

import { del, get, keys, set } from 'idb-keyval'
import { downscale } from '../cull/previews'
import type { Quality } from '../pdf/export'
import { allProjects, currentProject, newProject, useDoc, type Asset, type Page, type Project } from './doc'

const PROJECTS_KEY = 'foto-gns:projects'
/** The single layout saved before projects existed. */
const LEGACY_KEY = 'foto-gns:doc'
const ASSET_PREFIX = 'foto-gns:asset:'
const assetKey = (id: string) => ASSET_PREFIX + id

interface Saved {
  v: 2
  activeId: string
  projects: Project[]
}

interface Legacy {
  v: 1
  pages: Page[]
  fileName: string
  quality?: Quality
}

const photoIds = (pages: Page[]) => new Set(pages.flatMap((p) => p.fields.map((f) => f.photo?.assetId).filter((x): x is string => !!x)))

/** Load a project's photos from storage, with screen previews. */
async function loadAssets(pages: Page[]) {
  const assets: Record<string, Asset> = {}
  for (const id of photoIds(pages)) {
    const rec = (await get(assetKey(id))) as { blob: Blob; w: number; h: number; preview?: Blob } | undefined
    if (!rec) continue
    // The stored screen preview opens instantly; older saves build one once.
    let preview = rec.preview
    if (!preview) preview = await downscale(rec.blob, 2000, 0.9).then((r) => r.blob, () => undefined)
    assets[id] = { blob: rec.blob, w: rec.w, h: rec.h, preview, url: URL.createObjectURL(preview ?? rec.blob) }
  }
  return assets
}

/** A photo whose blob went missing leaves its field empty rather than broken. */
const dropMissing = (pages: Page[], assets: Record<string, Asset>) =>
  pages.map((p) => ({ ...p, fields: p.fields.map((f) => (f.photo && !assets[f.photo.assetId] ? { ...f, photo: undefined } : f)) }))

const revokeAll = (assets: Record<string, Asset>) => Object.values(assets).forEach((a) => URL.revokeObjectURL(a.url))

/** Bring back the last session. Resolves true if there was one with something in it. */
export async function restore(): Promise<boolean> {
  try {
    let saved = (await get(PROJECTS_KEY)) as Saved | undefined
    if (!saved) {
      // First run with projects: the old layout becomes the first project.
      const legacy = (await get(LEGACY_KEY)) as Legacy | undefined
      if (!legacy || legacy.v !== 1) return false
      const p = { ...newProject(legacy.fileName ?? ''), pages: legacy.pages, quality: legacy.quality ?? 'original' }
      saved = { v: 2, activeId: p.id, projects: [p] }
    }
    if (saved.v !== 2 || !saved.projects.length) return false
    const active = saved.projects.find((p) => p.id === saved.activeId) ?? saved.projects[0]
    const assets = await loadAssets(active.pages)
    const opened = { ...active, pages: dropMissing(active.pages, assets) }
    useDoc.getState().openProject(opened, assets, saved.projects)
    return saved.projects.some((p) => p.pages.some((pg) => pg.fields.length > 0))
  } catch {
    // Private browsing or blocked storage: start fresh.
    return false
  }
}

let timer: ReturnType<typeof setTimeout> | undefined
let dirty = false
const savedAssets = new Set<string>()

async function save() {
  clearTimeout(timer)
  const s = useDoc.getState()
  try {
    // The open project's new photos first, so the layout never points at a missing one.
    for (const id of photoIds(s.pages)) {
      if (savedAssets.has(id)) continue
      const a = s.assets[id]
      if (!a) continue
      await set(assetKey(id), { blob: a.blob, w: a.w, h: a.h, preview: a.preview })
      savedAssets.add(id)
    }
    let projects = allProjects(s)
    if (dirty) {
      projects = projects.map((p) => (p.id === s.projectId ? { ...p, updated: Date.now() } : p))
      dirty = false
    }
    useDoc.setState({ projects })
    await set(PROJECTS_KEY, { v: 2, activeId: s.projectId, projects } satisfies Saved)
    await del(LEGACY_KEY)
    // Drop photos no project uses any more.
    const used = new Set(projects.flatMap((p) => [...photoIds(p.pages)]))
    for (const k of await keys()) {
      const key = String(k)
      if (!key.startsWith(ASSET_PREFIX)) continue
      const id = key.slice(ASSET_PREFIX.length)
      if (!used.has(id)) {
        await del(key)
        savedAssets.delete(id)
      }
    }
  } catch {
    // Storage full or unavailable; the session still works.
  }
}

/** Save now, e.g. before switching projects. */
export const flushSave = () => save()

export function startAutosave() {
  // Everything already in storage when we start counts as saved.
  for (const p of useDoc.getState().projects) for (const id of photoIds(p.pages)) savedAssets.add(id)
  useDoc.subscribe((s, prev) => {
    if (s.projectId !== prev.projectId) return
    if (s.pages === prev.pages && s.projectName === prev.projectName && s.quality === prev.quality) return
    dirty = true
    clearTimeout(timer)
    timer = setTimeout(save, 400)
  })
}

// ── projects ──

let busy = false

async function open(target: Project, projects: Project[]) {
  const before = useDoc.getState().assets
  const assets = await loadAssets(target.pages)
  useDoc.getState().openProject({ ...target, pages: dropMissing(target.pages, assets) }, assets, projects)
  revokeAll(before)
  await save()
}

export async function switchProject(id: string) {
  const s = useDoc.getState()
  if (busy || id === s.projectId) return
  busy = true
  try {
    await save()
    const projects = useDoc.getState().projects
    const target = projects.find((p) => p.id === id)
    if (!target) return
    s.say(`Opening ${target.name || 'untitled project'}…`)
    await open(target, projects)
    s.say(`${target.name || 'Untitled project'} opened`)
  } finally {
    busy = false
  }
}

export async function addProject(name = '') {
  if (busy) return
  busy = true
  try {
    await save()
    const p = newProject(name)
    await open(p, [p, ...useDoc.getState().projects])
  } finally {
    busy = false
  }
}

export async function deleteProject(id: string) {
  if (busy) return
  busy = true
  try {
    const s = useDoc.getState()
    const rest = allProjects(s).filter((p) => p.id !== id)
    if (id !== s.projectId) {
      useDoc.setState({ projects: rest })
      await save()
      return
    }
    // Deleting the open one: open the most recently worked-on of the rest, or a fresh one.
    const next = [...rest].sort((a, b) => b.updated - a.updated)[0] ?? newProject()
    await open(next, rest.length ? rest : [next])
  } finally {
    busy = false
  }
}

export const projectStats = (p: Project) => ({
  pages: p.pages.length,
  photos: p.pages.reduce((n, pg) => n + pg.fields.filter((f) => f.photo).length, 0),
})

export { currentProject }
