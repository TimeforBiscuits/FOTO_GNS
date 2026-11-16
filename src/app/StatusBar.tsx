import { useEffect, useState } from 'react'
import { AREA, COLS, GRID, PRINT_DPI, ROWS } from '../model/layout'
import { useDoc } from '../store/doc'
import { useCursor } from './cursor'

/** Messages stay up for a few seconds. */
const useRecentMessage = () => {
  const message = useDoc((s) => s.message)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setNow(Date.now()), 4500)
    return () => clearTimeout(t)
  }, [message])
  return message && now - message.at < 4500 ? message : null
}

const coord = (v: number) => (v < 0 ? '−' : ' ') + Math.abs(v).toFixed(1).padStart(5, '0')

export function StatusBar() {
  const p = useCursor((s) => s.p)
  const selected = useDoc((s) => s.selectedId)
  const message = useRecentMessage()
  const [name, hint] = selected
    ? ['Field', 'drag to move · drag a corner to resize · arrows nudge 5 mm · ⌫ deletes']
    : ['Sheet', 'tap a size to add a field · drag on the grid to draw one · tap the picture icon to attach a photo']

  return (
    <footer className="statusbar">
      <span className="lcd" aria-label="Pointer position in millimetres, from the top-left of the grid">
        <span className="unit">X</span>
        {p ? coord(p.x - AREA.x) : ' ———.—'}
        <span className="unit">Y</span>
        {p ? coord(p.y - AREA.y) : ' ———.—'}
        <span className="unit">mm</span>
      </span>
      {message ? (
        <span className={message.tone === 'alert' ? 'msg msg--alert' : 'msg msg--info'} role="status">
          <b>{message.tone === 'alert' ? '!' : '✓'}</b> {message.text}
        </span>
      ) : (
        <span className="msg">
          <b>{name}</b> — {hint}
        </span>
      )}
      <span className="meta">
        A4 · grid {GRID} mm · {COLS}×{ROWS} · {PRINT_DPI} dpi · v0.1 alpha
      </span>
    </footer>
  )
}
