import { isJpeg, useCull } from '../store/cull'
import { useDoc } from '../store/doc'
import { clearLoupeCache } from './previews'

/** Safari on iPad can't choose a whole folder, only files (select all inside the folder). */
export const canPickFolder = () => {
  const touch = navigator.maxTouchPoints > 1
  return !touch && 'webkitdirectory' in document.createElement('input')
}

function pick(folder: boolean): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    if (folder) input.webkitdirectory = true
    else input.accept = 'image/jpeg,.jpg,.jpeg'
    input.style.display = 'none'
    const done = (files: File[]) => {
      resolve(files)
      input.remove()
    }
    input.addEventListener('change', () => done(Array.from(input.files ?? [])))
    input.addEventListener('cancel', () => done([]))
    document.body.appendChild(input)
    input.click()
  })
}

export async function openPhotos(folder: boolean) {
  const files = await pick(folder)
  if (!files.length) return
  await load(files, folder ? files[0].webkitRelativePath.split('/')[0] || 'Folder' : files.length === 1 ? files[0].name : `${files.length} files`)
}

export async function load(files: File[], source: string) {
  const s = useCull.getState()
  const jpgs = files.filter(isJpeg)
  if (!jpgs.length) {
    useDoc.getState().showAlert({ title: 'No JPGs found', body: 'Curation works with JPG files (.jpg or .jpeg). Nothing else in that selection was opened.' })
    return
  }
  if (s.items.length && !s.exported && Object.keys(s.keep).length && !window.confirm('Open new photos? Your current selezioni are remembered, but not yet saved.')) return
  clearLoupeCache()
  await s.open(jpgs, source)
  const skipped = files.length - jpgs.length
  useDoc.getState().say(`${jpgs.length} JPG${jpgs.length === 1 ? '' : 's'} opened${skipped ? ` · ${skipped} other file${skipped === 1 ? '' : 's'} ignored` : ''}`)
}

export function closePhotos() {
  clearLoupeCache()
  useCull.getState().close()
}
