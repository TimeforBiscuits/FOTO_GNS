import { create } from 'zustand'

/** The pointer's position on the sheet in millimetres, for the status bar. */
export const useCursor = create<{ p: { x: number; y: number } | null }>(() => ({ p: null }))

export const setCursor = (p: { x: number; y: number } | null) => useCursor.setState({ p })
