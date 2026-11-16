// The cull: put every selezione into a folder called SELECTS.
// Exact copies of the original files, never re-encoded; the originals are
// never touched.
//  · Chrome / Edge on the Mac: you pick a place, SELECTS is created there.
//  · Safari (Mac and iPad) can't create folders, so it gets SELECTS.zip, which
//    opens into the SELECTS folder: Safari on the Mac unpacks it by itself;
//    on iPad, Save to Files, then tap the zip once.

import { create } from 'zustand'
import { keepCount, useCull } from '../store/cull'
import { useDoc } from '../store/doc'
import { storedZip, ZIP_MAX } from './zip'

export const SELECTS = 'SELECTS'

export type SavePhase =
  | null
  | { kind: 'progress'; label: string; done: number; total: number }
  | { kind: 'share'; file: File }
  | { kind: 'done'; kept: number; rejected: number; how: string }

export const useSave = create<{ phase: SavePhase }>(() => ({ phase: null }))
const setPhase = (phase: SavePhase) => useSave.setState({ phase })

interface FileHandle {
  getFile: () => Promise<File>
  createWritable: () => Promise<{ write: (d: Blob) => Promise<void>; close: () => Promise<void> }>
}
interface DirHandle {
  name: string
  getDirectoryHandle: (name: string, opts?: { create?: boolean }) => Promise<DirHandle>
  getFileHandle: (name: string, opts?: { create?: boolean }) => Promise<FileHandle>
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

export async function createSelects() {
  const files = keepers()
  if (!files.length) {
    useDoc.getState().showAlert({ title: 'No selezioni yet', body: 'Mark the photos you want to keep first (★ or P). Everything not marked is left behind.' })
    return
  }
  const method = saveMethod()
  if (method === 'folder') return saveToFolder(files)

  const total = files.reduce((n, f) => n + f.size, 0)
  if (total > ZIP_MAX) {
    useDoc.getState().showAlert({
      title: 'Too big for one zip',
      body: `Your selezioni come to ${(total / 1024 ** 3).toFixed(1)} GB; a zip holds up to 4 GB. Use Chrome on the Mac (it writes the SELECTS folder directly), or cull in two rounds.`,
    })
    return
  }
  let zip: Blob
  try {
    zip = await storedZip(SELECTS, files, (done, n) => setPhase({ kind: 'progress', label: 'Packing SELECTS', done, total: n }))
  } catch (e) {
    setPhase(null)
    useDoc.getState().showAlert({ title: 'SELECTS not created', body: (e as Error).message || 'A file could not be read.' })
    return
  }
  const file = new File([zip], `${SELECTS}.zip`, { type: 'application/zip' })
  // The share sheet needs a fresh tap after the packing.
  if (method === 'share' && navigator.canShare?.({ files: [file] })) return setPhase({ kind: 'share', file })
  download(file)
  finish(
    method === 'share'
      ? 'SELECTS.zip was downloaded. In Files, open Downloads, tap SELECTS.zip to unpack the SELECTS folder, then move it where you like.'
      : 'SELECTS.zip was downloaded. Safari unpacks it into a SELECTS folder in your Downloads (unless “Open safe files after downloading” is off; then double-click the zip).',
  )
}

async function saveToFolder(files: File[]) {
  let parent: DirHandle
  try {
    parent = await (window as DirWindow).showDirectoryPicker!({ mode: 'readwrite', id: 'foto-gns-selects' })
  } catch (e) {
    if ((e as Error).name !== 'AbortError') useDoc.getState().showAlert({ title: 'Folder not available', body: (e as Error).message })
    return
  }
  let skipped = 0
  try {
    const dir = await parent.getDirectoryHandle(SELECTS, { create: true })
    for (let i = 0; i < files.length; i++) {
      setPhase({ kind: 'progress', label: `Copying into ${parent.name}/${SELECTS}`, done: i, total: files.length })
      const f = files[i]
      // Already there (e.g. culling again into the same place)? Leave it alone.
      const existing = await dir.getFileHandle(f.name).then(
        (h) => h.getFile(),
        () => null,
      )
      if (existing && existing.size === f.size) {
        skipped++
        continue
      }
      const name = existing ? f.name.replace(/(\.[^.]+)?$/, (ext) => `-${i + 1}${ext}`) : f.name
      const out = await (await dir.getFileHandle(name, { create: true })).createWritable()
      await out.write(f)
      await out.close()
    }
  } catch (e) {
    setPhase(null)
    useDoc.getState().showAlert({ title: 'Copying stopped', body: (e as Error).message || 'A file could not be written.' })
    return
  }
  finish(`The folder ${parent.name}/${SELECTS} now holds your selezioni${skipped ? ` (${skipped} were already there)` : ''}.`)
}

/** iPad: hand SELECTS.zip to the share sheet from its own tap. */
export async function shareSelects() {
  const phase = useSave.getState().phase
  if (phase?.kind !== 'share') return
  try {
    await navigator.share({ files: [phase.file] })
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
    download(phase.file)
    finish('The share sheet failed, so SELECTS.zip was downloaded instead. In Files, open Downloads and tap SELECTS.zip to unpack it.')
    return
  }
  finish('SELECTS.zip is saved. In Files, tap it once to unpack the SELECTS folder; you can then delete the zip.')
}

function download(blob: Blob & { name?: string }) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = blob.name ?? `${SELECTS}.zip`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 120_000)
}

export const closeSave = () => setPhase(null)
