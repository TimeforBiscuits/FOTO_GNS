import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import {
  A4,
  AREA,
  COLS,
  GRID,
  ROWS,
  RATIOS,
  clampToArea,
  fmtMm,
  overlaps,
  ratioOf,
  resizeFromCorner,
  snap,
  snapPosition,
  type Corner,
  type Rect,
} from '../model/layout'
import { useActivePage, useDoc, type Field } from '../store/doc'
import { attachTo } from './attach'
import { SIZE_COLOR } from './colors'
import { setCursor } from './cursor'

const PAD = 14


type Drag =
  | { kind: 'move'; id: string; start: { x: number; y: number }; orig: Rect; moved: boolean }
  | { kind: 'resize'; id: string; corner: Corner; orig: Rect; ratio: number }
  | { kind: 'draw'; start: { x: number; y: number }; id: string | null }

export function Sheet() {
  const page = useActivePage()
  const selectedId = useDoc((s) => s.selectedId)
  const ratio = useDoc((s) => s.ratio)
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<Drag | null>(null)
  const [dragging, setDragging] = useState(false)

  const toMm = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current!
    const m = svg.getScreenCTM()
    if (!m) return { x: 0, y: 0 }
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    return { x: p.x, y: p.y }
  }

  const begin = (e: RPointerEvent, d: Drag) => {
    e.stopPropagation()
    svgRef.current?.setPointerCapture(e.pointerId)
    drag.current = d
    setDragging(true)
  }

  const onBackgroundDown = (e: RPointerEvent) => {
    if (e.button !== 0) return
    const p = toMm(e)
    useDoc.getState().select(null)
    const inside = p.x >= AREA.x && p.x <= AREA.x + AREA.w && p.y >= AREA.y && p.y <= AREA.y + AREA.h
    if (!inside) return
    const start = e.altKey ? p : { x: AREA.x + snap(p.x - AREA.x), y: AREA.y + snap(p.y - AREA.y) }
    begin(e, { kind: 'draw', start, id: null })
  }

  const onMove = (e: RPointerEvent) => {
    const p = toMm(e)
    setCursor(p)
    const d = drag.current
    if (!d) return
    const s = useDoc.getState()
    if (d.kind === 'move') {
      const dx = p.x - d.start.x
      const dy = p.y - d.start.y
      if (!d.moved && Math.hypot(dx, dy) < 1) return
      d.moved = true
      const moved = { ...d.orig, x: d.orig.x + dx, y: d.orig.y + dy }
      const r = e.altKey ? clampToArea(moved) : snapPosition(moved)
      s.updateField(d.id, { x: r.x, y: r.y })
    } else if (d.kind === 'resize') {
      s.updateField(d.id, resizeFromCorner(d.orig, d.corner, p, d.ratio, e.altKey))
    } else {
      const dx = p.x - d.start.x
      const dy = p.y - d.start.y
      if (!d.id && Math.hypot(dx, dy) < 2) return
      const corner: Corner = dy < 0 ? (dx < 0 ? 'nw' : 'ne') : dx < 0 ? 'sw' : 'se'
      // A zero-size rect at the start point, grown from its opposite corner.
      const seed = { x: d.start.x, y: d.start.y, w: 0, h: 0 }
      const r = resizeFromCorner(seed, corner, p, ratioOf(s.ratio), e.altKey)
      if (!d.id) {
        s.addField('free', r)
        d.id = useDoc.getState().selectedId
      } else s.updateField(d.id, r)
    }
  }

  const onUp = () => {
    drag.current = null
    setDragging(false)
  }

  // Keyboard: delete, nudge, deselect.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return
      const s = useDoc.getState()
      if (s.alert || s.ready) return
      const f = s.pages[s.activePage].fields.find((x) => x.id === s.selectedId)
      if (e.key === 'Escape') s.select(null)
      if (!f) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        s.deleteField(f.id)
      }
      const step = e.shiftKey ? GRID * 5 : e.altKey ? 0.5 : GRID
      const nudge: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
      const n = nudge[e.key]
      if (n) {
        e.preventDefault()
        const r = clampToArea({ ...f, x: f.x + n[0], y: f.y + n[1] })
        s.updateField(f.id, { x: r.x, y: r.y })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const clash = new Set<string>()
  page.fields.forEach((a, i) => page.fields.slice(i + 1).forEach((b) => overlaps(a, b) && (clash.add(a.id), clash.add(b.id))))

  return (
    <div className="workspace">
      <svg
        ref={svgRef}
        viewBox={`${-PAD} ${-PAD} ${A4.w + 2 * PAD} ${A4.h + 2 * PAD}`}
        preserveAspectRatio="xMidYMid meet"
        className={dragging ? 'is-dragging' : undefined}
        onPointerDown={onBackgroundDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={() => setCursor(null)}
      >
        <defs>
          <pattern id="hatch" width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="0.6" height="2" fill="#e01b1b" opacity="0.5" />
          </pattern>
        </defs>

        {/* the sheet */}
        <rect x={1.6} y={2.2} width={A4.w} height={A4.h} fill="#000" opacity={0.45} />
        <rect x={0} y={0} width={A4.w} height={A4.h} fill="var(--paper)" />
        <Grid />

        {page.fields.map((f) => (
          <FieldView key={f.id} f={f} selected={f.id === selectedId} clash={clash.has(f.id)} onBodyDown={(e) => {
            if (e.button !== 0) return
            useDoc.getState().select(f.id)
            begin(e, { kind: 'move', id: f.id, start: toMm(e), orig: { x: f.x, y: f.y, w: f.w, h: f.h }, moved: false })
          }} onHandleDown={(e, corner) => begin(e, { kind: 'resize', id: f.id, corner, orig: { x: f.x, y: f.y, w: f.w, h: f.h }, ratio: ratioOf(f.ratio) })} />
        ))}

        {page.fields.length === 0 && (
          <text x={A4.w / 2} y={A4.h / 2} className="sheet-hint" textAnchor="middle">
            <tspan x={A4.w / 2}>Pick a ratio and a size on the right,</tspan>
            <tspan x={A4.w / 2} dy={6}>or drag on the grid to draw a {RATIOS[ratio].label} field</tspan>
          </text>
        )}

        <text x={0} y={A4.h + 7} className="sheet-label">
          A4 · 210 × 297 mm
        </text>
      </svg>
    </div>
  )
}

function Grid() {
  const lines = []
  for (let c = 0; c <= COLS; c++) {
    const x = AREA.x + c * GRID
    lines.push(<line key={`c${c}`} x1={x} x2={x} y1={AREA.y} y2={AREA.y + AREA.h} className={c % 5 === 0 ? 'g-major' : 'g-minor'} />)
  }
  for (let r = 0; r <= ROWS; r++) {
    const y = AREA.y + r * GRID
    lines.push(<line key={`r${r}`} y1={y} y2={y} x1={AREA.x} x2={AREA.x + AREA.w} className={r % 5 === 0 ? 'g-major' : 'g-minor'} />)
  }
  return (
    <g pointerEvents="none">
      {lines}
      <rect x={AREA.x} y={AREA.y} width={AREA.w} height={AREA.h} className="g-edge" fill="none" />
    </g>
  )
}

const CORNERS: Corner[] = ['nw', 'ne', 'sw', 'se']
const cornerAt = (f: Rect, c: Corner) => ({ x: c === 'nw' || c === 'sw' ? f.x : f.x + f.w, y: c === 'nw' || c === 'ne' ? f.y : f.y + f.h })

function FieldView({
  f,
  selected,
  clash,
  onBodyDown,
  onHandleDown,
}: {
  f: Field
  selected: boolean
  clash: boolean
  onBodyDown: (e: RPointerEvent) => void
  onHandleDown: (e: RPointerEvent, c: Corner) => void
}) {
  const asset = useDoc((s) => (f.photo ? s.assets[f.photo.assetId] : undefined))
  const color = SIZE_COLOR[f.size]
  const locked = f.size !== 'free'
  const tagText = `${RATIOS[f.ratio].label}${locked ? ' · ' + f.size.toUpperCase() : ''} · ${fmtMm(f.w)}×${fmtMm(f.h)}`
  const btn = Math.min(9, f.w / 3.2, f.h / 3.2)
  const cx = f.x + f.w / 2
  const cy = f.y + f.h / 2

  return (
    <g className={selected ? 'field is-selected' : 'field'}>
      <rect x={f.x} y={f.y} width={f.w} height={f.h} fill={asset ? '#fff' : color} fillOpacity={asset ? 1 : 0.07} onPointerDown={onBodyDown} className="field-body" />
      {asset && (
        <image href={asset.url} x={f.x} y={f.y} width={f.w} height={f.h} preserveAspectRatio="xMidYMid slice" pointerEvents="none" />
      )}
      {clash && <rect x={f.x} y={f.y} width={f.w} height={f.h} fill="url(#hatch)" pointerEvents="none" />}
      <rect
        x={f.x}
        y={f.y}
        width={f.w}
        height={f.h}
        fill="none"
        stroke={clash ? '#e01b1b' : color}
        strokeWidth={selected ? 2.5 : 1.5}
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />

      {/* label tab */}
      {(selected || !asset) && (
        <g pointerEvents="none">
          <rect x={f.x} y={f.y} width={Math.min(f.w, tagText.length * 1.72 + 3)} height={4.4} fill={color} />
          <text x={f.x + 1.4} y={f.y + 3.15} className="field-tag">
            {tagText}
          </text>
        </g>
      )}

      {/* attach button */}
      {!asset && (
        <g
          className="attach"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            useDoc.getState().select(f.id)
            void attachTo(f)
          }}
          role="button"
          aria-label="Attach a photo"
        >
          <circle cx={cx} cy={cy} r={btn} className="attach-disc" />
          <g transform={`translate(${cx - btn * 0.5} ${cy - btn * 0.42}) scale(${btn / 24})`} className="attach-icon">
            <rect x="1" y="2.5" width="22" height="17" />
            <path d="M1 16 L8 9.5 L13 14.5 L16.5 11 L23 17" />
            <rect x="16" y="5.5" width="3" height="3" fill="currentColor" stroke="none" />
          </g>
          <text x={cx} y={cy + btn + 4.2} textAnchor="middle" className="attach-label">
            {f.h > 30 ? 'ATTACH PHOTO' : ''}
          </text>
        </g>
      )}

      {/* corners: draggable on free fields, fixed pins on pre-registered ones */}
      {selected &&
        CORNERS.map((c) => {
          const p = cornerAt(f, c)
          return locked ? (
            <rect key={c} x={p.x - 1} y={p.y - 1} width={2} height={2} fill={color} pointerEvents="none" />
          ) : (
            <g key={c} onPointerDown={(e) => onHandleDown(e, c)} className={`handle handle--${c}`}>
              <circle cx={p.x} cy={p.y} r={5} fill="transparent" />
              <circle cx={p.x} cy={p.y} r={1.7} fill="#fff" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
            </g>
          )
        })}
    </g>
  )
}
