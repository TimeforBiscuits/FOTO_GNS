// Saving the selezioni: exact copies of the original files, never re-encoded.
//  · Chrome / Edge on the Mac: straight into a folder you choose.
//  · iPad: the share sheet → "Save to Files", in batches (each needs a tap).
//  · Safari on the Mac: one .zip download (or one download per file if huge).

import { zipSync } from 'fflate'
import { create } from 'zustand'
import { stamp } from '../app/files'
import { keepCount, useCull } from '../store/cull'
import { useDoc } from '../store/doc'

export const SHARE_BATCH = 40
const ZIP_LIMIT = 1.5 * 1024 ** 3

export type SavePhase =
  | null
  | { kind: 'progress'; done: number; total: number }
  | { kind: 'share'; files: File[]; next: number }
  | { kind: 'done'; kept: number; rejected: number; how: string }

export const useSave = create<{ phase: SavePhase }>(() => ({ phase: null }))
const setPhase = (phase: SavePhase) => useSave.setState({ phase })

interface DirHandle {
  name: string
  getFileHandle: (name: string, opts?: { create?: boolean }) => Promise<{
    getFile: () => Promise<File>
    createWritable: () => Promise<{ write: (d: Blob) => Promise<void>; close: () => Promise<void> }>
  }>
}
type DirWindow = { showDirectoryPicker?: (opts?: unknown) => Promise<DirHandle> }

export const saveMethod = (): 'folder' | 'share' | 'zip' =>
  typeof (window as DirWindow).showDirectoryPicker === 'function' ? 'folder' : navigator.maxTouchPoints > 1 ? 'share' : 'zip'

const keepers = () => {
  const s = useCull.getState()
  return s.items.filter((it) => s.keep[it.id]).map((it) => it.file)
}

const finish = (how: string) => {
  const s = useCull.getState()
  const kept = keepCount(s.keep)
  s.setExported(true)
  setPhase({ kind: 'done', kept, rejected: s.items.length - kept, how })
}

export async function saveKeepers() {
  const files = keepers()
  if (!files.length) {
    useDoc.getState().showAlert({ title: 'No selezioni yet', body: 'Mark the photos you want to keep first (★ or P). Everything not marked is left behind.' })
    return
  }
  const method = saveMethod()
  if (method === 'share') return setPhase({ kind: 'share', files, next: 0 })
  if (method === 'folder') return saveToFolder(files)
  return saveAsZip(files)
}

async function saveToFolder(files: File[]) {
  let dir: DirHandle
  try {
    dir = await (window as DirWindow).showDirectoryPicker!({ mode: 'readwrite', id: 'foto-gns-selezioni' })
  } catch (e) {
    if ((e as Error).name !== 'AbortError') useDoc.getState().showAlert({ title: 'Folder not available', body: (e as Error).message })
    return
  }
  let skipped = 0
  try {
    for (let i = 0; i < files.length; i++) {
      setPhase({ kind: 'progress', done: i, total: files.length })
      const f = files[i]
      // Already there (e.g. saving again)? Leave it alone.
      const existing = await dir.getFileHandle(f.name).then((h) => h.getFile(), () => null)
      if (existing && existing.size === f.size) {
        skipped++
        continue
      }
      const h = await dir.getFileHandle(existing ? uniqueName(f.name, i) : f.name, { create: true })
      const out = await h.createWritable()
      await out.write(f)
      await out.close()
    }
  } catch (e) {
    setPhase(null)
    useDoc.getState().showAlert({ title: 'Saving stopped', body: (e as Error).message || 'A file could not be written.' })
    return
  }
  finish(`Saved to the folder “${dir.name}”${skipped ? ` (${skipped} already there)` : ''}.`)
}

const uniqueName = (name: string, i: number) => name.replace(/(\.[^.]+)?$/, (ext) => `-${i + 1}${ext}`)

/** iPad: each batch goes to the share sheet from its own tap. */
export async function shareNextBatch() {
  const phase = useSave.getState().phase
  if (phase?.kind !== 'share') return
  const batch = phase.files.slice(phase.next, phase.next + SHARE_BATCH)
  try {
    await navigator.share({ files: batch })
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
    useDoc.getState().showAlert({ title: 'Share sheet failed', body: `${(e as Error).message || 'The files could not be shared.'} Try again.` })
    return
  }
  const next = phase.next + batch.length
  if (next >= phase.files.length) finish('Saved through the share sheet.')
  else setPhase({ ...phase, next })
}

async function saveAsZip(files: File[]) {
  const total = files.reduce((n, f) => n + f.size, 0)
  if (total > ZIP_LIMIT) {
    // Too big to zip in memory: hand them over one by one.
    for (let i = 0; i < files.length; i++) {
      setPhase({ kind: 'progress', done: i, total: files.length })
      download(files[i], files[i].name)
      await new Promise((r) => setTimeout(r, 350))
    }
    return finish('Downloaded one by one to your Downloads folder.')
  }
  const entries: Record<string, [Uint8Array, { level: 0 }]> = {}
  const used = new Set<string>()
  for (let i = 0; i < files.length; i++) {
    setPhase({ kind: 'progress', done: i, total: files.length })
    let name = files[i].name
    if (used.has(name)) name = uniqueName(name, i)
    used.add(name)
    entries[name] = [new Uint8Array(await files[i].arrayBuffer()), { level: 0 }]
  }
  const zipName = `FOTO_GNS-selezioni-${stamp()}.zip`
  download(new Blob([zipSync(entries) as BlobPart], { type: 'application/zip' }), zipName)
  finish(`Downloaded as ${zipName}.`)
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export const closeSave = () => setPhase(null)
