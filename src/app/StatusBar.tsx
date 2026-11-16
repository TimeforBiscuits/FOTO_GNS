import { useEffect, useState } from 'react'
import { AREA, COLS, GRID, PRINT_DPI, ROWS } from '../model/layout'
import { keepCount, useCull } from '../store/cull'
import { useDoc } from '../store/doc'
import { useView } from '../store/view'
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
  const view = useView((s) => s.view)
  if (view === 'cull') return <CullStatus message={message} />
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
        A4 · grid {GRID} mm · {COLS}×{ROWS} · {PRINT_DPI} dpi · v0.2 alpha
      </span>
    </footer>
  )
}

function CullStatus({ message }: { message: ReturnType<typeof useRecentMessage> }) {
  const count = useCull((s) => s.items.length)
  const kept = useCull((s) => keepCount(s.keep))
  const seen = useCull((s) => Object.keys(s.seen).length)
  const pad = (n: number) => String(n).padStart(3, '0')
  return (
    <footer className="statusbar">
      <span className="lcd" aria-label="Selezioni and photos seen">
        <span className="unit">★</span>
        {pad(kept)}
        <span className="unit">seen</span>
        {pad(seen)}
        <span className="unit">/</span>
        {pad(count)}
      </span>
      {message ? (
        <span className={message.tone === 'alert' ? 'msg msg--alert' : 'msg msg--info'} role="status">
          <b>{message.tone === 'alert' ? '!' : '✓'}</b> {message.text}
        </span>
      ) : (
        <span className="msg">
          <b>Selezione</b> — {count ? 'P keep · X leave behind · ← → move · G grid · everything not kept is left behind' : 'open a folder of JPGs to start'}
        </span>
      )}
      <span className="meta">originals are never changed or deleted · v0.2 alpha</span>
    </footer>
  )
}
