import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('idb-keyval', () => {
  const m = new Map<string, unknown>()
  return { get: async (k: string) => m.get(k), set: async (k: string, v: unknown) => void m.set(k, v) }
})

const { decide, isJpeg, useCull, visibleItems } = await import('./cull')

const jpg = (name: string) => new File([new Uint8Array(4)], name, { type: 'image/jpeg', lastModified: 1 })

describe('curation', () => {
  beforeEach(async () => {
    await useCull.getState().open([jpg('IMG_10.jpg'), jpg('IMG_2.JPG'), jpg('IMG_1.jpeg')], 'test')
    useCull.getState().setAutoAdvance(true)
  })

  it('opens JPGs only, in natural order', () => {
    expect(isJpeg(new File([], 'a.png', { type: 'image/png' }))).toBe(false)
    expect(useCull.getState().items.map((i) => i.name)).toEqual(['IMG_1.jpeg', 'IMG_2.JPG', 'IMG_10.jpg'])
  })

  it('keeps, advances, and counts what has been seen', () => {
    decide(true)
    const s = useCull.getState()
    expect(s.keep).toEqual({ 0: true })
    expect(s.index).toBe(1)
    expect(Object.keys(s.seen).length).toBe(2)
  })

  it('steps within a filter', () => {
    decide(true)
    decide(false)
    decide(true)
    const s = useCull.getState()
    s.setFilter('keep')
    expect(visibleItems(useCull.getState()).map((i) => i.id)).toEqual([0, 2])
    s.go(0)
    s.step(1)
    expect(useCull.getState().index).toBe(2)
  })

  it('remembers selezioni when the same files open again', async () => {
    decide(true)
    await new Promise((r) => setTimeout(r, 350))
    await useCull.getState().open([jpg('IMG_1.jpeg'), jpg('IMG_2.JPG')], 'again')
    expect(useCull.getState().keep).toEqual({ 0: true })
  })
})
