import { create } from 'zustand'

/** The two halves of the app: curation (selezione) and layout (impaginazione). */
export type ViewId = 'cull' | 'layout'

const KEY = 'foto-gns:view'
const initial = (): ViewId => {
  try {
    return localStorage.getItem(KEY) === 'cull' ? 'cull' : 'layout'
  } catch {
    return 'layout'
  }
}

export const useView = create<{ view: ViewId; setView: (v: ViewId) => void }>((set) => ({
  view: initial(),
  setView: (view) => {
    try {
      localStorage.setItem(KEY, view)
    } catch {
      // per-session only
    }
    set({ view })
  },
}))
