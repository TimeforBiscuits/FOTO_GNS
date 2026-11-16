import { describe, expect, it, vi } from 'vitest'

const db = new Map<string, unknown>()
vi.mock('idb-keyval', () => ({
  get: async (k: string) => db.get(k),
  set: async (k: string, v: unknown) => void db.set(k, v),
  del: async (k: string) => void db.delete(k),
  keys: async () => [...db.keys()],
}))
vi.mock('../cull/previews', () => ({ downscale: async () => ({ url: 'blob:preview', w: 3, h: 2 }) }))
globalThis.URL.revokeObjectURL = () => {}

const { useDoc } = await import('./doc')
const { addProject, deleteProject, flushSave, restore, startAutosave, switchProject } = await import('./persist')

const photo = (id: string) => ({ assetId: id, name: `${id}.jpg`, pxW: 3, pxH: 2 })
const asset = () => ({ blob: new Blob(['x']), url: 'blob:x', w: 3, h: 2 })

describe('projects', () => {
  // The two steps run in order and share storage.
  it('turns the old single layout into the first project', async () => {
    db.set('foto-gns:doc', {
      v: 1,
      fileName: 'Tenerife trip',
      quality: 'print300',
      pages: [{ id: 'p1', fields: [{ id: 'f1', ratio: '3x2', size: 'free', x: 10, y: 11, w: 60, h: 40, photo: photo('a1') }] }],
    })
    db.set('foto-gns:asset:a1', { blob: new Blob(['x']), w: 3, h: 2 })
    expect(await restore()).toBe(true)
    const s = useDoc.getState()
    expect(s.projectName).toBe('Tenerife trip')
    expect(s.quality).toBe('print300')
    expect(s.projects).toHaveLength(1)
    expect(s.pages[0].fields[0].photo?.assetId).toBe('a1')
    startAutosave()
  })

  it('creates, switches between and deletes projects, keeping each one’s pages and photos', async () => {
    const first = useDoc.getState().projectId
    await addProject()
    useDoc.getState().setProjectName('Rainy weekend')
    useDoc.getState().addField('a5')
    const fid = useDoc.getState().selectedId!
    useDoc.getState().attachPhoto(fid, photo('b1'), asset())
    await flushSave()
    const second = useDoc.getState().projectId
    expect(useDoc.getState().projects.map((p) => p.name)).toEqual(['Rainy weekend', 'Tenerife trip'])

    await switchProject(first)
    expect(useDoc.getState().projectName).toBe('Tenerife trip')
    expect(useDoc.getState().pages[0].fields[0].photo?.assetId).toBe('a1')

    await switchProject(second)
    expect(useDoc.getState().projectName).toBe('Rainy weekend')
    expect(useDoc.getState().pages[0].fields[0].photo?.assetId).toBe('b1')
    expect(useDoc.getState().assets.b1).toBeTruthy()

    // deleting the open project opens another, and its photos leave storage
    await deleteProject(second)
    expect(useDoc.getState().projectName).toBe('Tenerife trip')
    expect(db.has('foto-gns:asset:b1')).toBe(false)
    expect(db.has('foto-gns:asset:a1')).toBe(true)

    // deleting the last one leaves a fresh, empty project
    await deleteProject(first)
    const s = useDoc.getState()
    expect(s.projects).toHaveLength(1)
    expect(s.projectName).toBe('')
    expect(s.pages[0].fields).toHaveLength(0)
    expect(db.has('foto-gns:asset:a1')).toBe(false)
    expect((db.get('foto-gns:projects') as { projects: unknown[] }).projects).toHaveLength(1)
  })
})
