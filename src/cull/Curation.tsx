import { memo, useEffect, useRef } from 'react'
import { decide, toggleCurrent, useCull, visibleItems, type CullItem } from '../store/cull'
import { useDoc } from '../store/doc'
import { Key } from '../ui/controls'
import { IconChevron, IconFolder, IconImage, IconStar, IconX } from '../ui/icons'
import { canPickFolder, load, openPhotos } from './open'
import { useLoupe } from './previews'

export function Curation() {
  const count = useCull((s) => s.items.length)
  const mode = useCull((s) => s.mode)
  useCullKeys()
  return (
    <div className="cull-stage">
      {count === 0 ? <Empty /> : mode === 'loupe' ? <Loupe /> : <ContactSheet />}
    </div>
  )
}

function useCullKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || e.metaKey || e.ctrlKey) return
      const d = useDoc.getState()
      if (d.alert) return
      const s = useCull.getState()
      if (!s.items.length) return
      const k = e.key.toLowerCase()
      if (k === 'arrowright') s.step(1)
      else if (k === 'arrowleft') s.step(-1)
      else if (k === 'p' || k === 'k') decide(true)
      else if (k === 'x' || k === 'u') decide(false)
      else if (k === ' ') toggleCurrent()
      else if (k === 'g') s.setMode(s.mode === 'grid' ? 'loupe' : 'grid')
      else if (k === 'enter' || k === 'escape') s.setMode(k === 'enter' && s.mode === 'grid' ? 'loupe' : k === 'escape' ? 'grid' : s.mode)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

function Empty() {
  const folder = canPickFolder()
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    if (files.length) void load(files, `${files.length} files`)
  }
  return (
    <div className="cull-empty" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <div className="cull-empty-card">
        <svg viewBox="0 0 32 32" width="44" height="44" aria-hidden="true">
          <path d="M13 6 L7 26 M22 6 L16 26" stroke="#ff4f00" strokeWidth="3.6" strokeLinecap="square" />
        </svg>
        <b>Selezione</b>
        <p>
          Open a folder of JPGs, go through them, and mark the keepers. The rest are left behind. Your originals are only read, never
          changed or deleted.
        </p>
        <div className="cull-empty-keys">
          {folder && (
            <Key variant="signal" onClick={() => void openPhotos(true)}>
              <IconFolder />
              Open folder
            </Key>
          )}
          <Key variant={folder ? 'plain' : 'signal'} onClick={() => void openPhotos(false)}>
            <IconImage />
            {folder ? 'Open JPGs' : 'Open JPGs from Files'}
          </Key>
        </div>
        <p className="cull-empty-hint">
          {folder ? 'Or drop JPGs here.' : 'In the Files picker, go into the folder, tap Select, then Select All.'}
        </p>
      </div>
    </div>
  )
}

function Loupe() {
  const items = useCull((s) => s.items)
  const index = useCull((s) => s.index)
  const kept = useCull((s) => !!s.keep[s.index])
  const filter = useCull((s) => s.filter)
  const keep = useCull((s) => s.keep)
  const item = items[index]
  const vis = visibleItems({ items, keep, filter })
  const pos = vis.findIndex((it) => it.id === index)
  const url = useLoupe(item, [items[index + 1], items[index - 1], items[index + 2]])
  const swipe = useRef<{ x: number; y: number; t: number } | null>(null)
  const lastTap = useRef(0)

  return (
    <div className="loupe">
      <div
        className={kept ? 'loupe-view is-kept' : 'loupe-view'}
        onPointerDown={(e) => (swipe.current = { x: e.clientX, y: e.clientY, t: Date.now() })}
        onPointerUp={(e) => {
          const s0 = swipe.current
          swipe.current = null
          if (!s0) return
          const dx = e.clientX - s0.x
          const dy = e.clientY - s0.y
          if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            useCull.getState().step(dx < 0 ? 1 : -1)
            return
          }
          if (Math.hypot(dx, dy) < 10) {
            const now = Date.now()
            if (now - lastTap.current < 320) {
              toggleCurrent()
              lastTap.current = 0
            } else lastTap.current = now
          }
        }}
      >
        {item.broken ? (
          <div className="loupe-broken">This file could not be opened as a picture.</div>
        ) : (
          (url || item.thumb) && <img src={url ?? item.thumb} alt={item.name} className={url ? '' : 'is-soft'} draggable={false} />
        )}
        {!url && !item.broken && <span className="loupe-loading">Building preview…</span>}
        {kept && (
          <span className="loupe-badge">
            <IconStar filled /> Selezione
          </span>
        )}
      </div>

      <div className="loupe-bar">
        <span className="loupe-name" title={item.file.webkitRelativePath || item.name}>
          {item.name}
          {item.w && (
            <small>
              {item.w} × {item.h}
            </small>
          )}
        </span>
        <div className="loupe-keys">
          <Key square onClick={() => useCull.getState().step(-1)} aria-label="Previous photo" title="Previous (←)">
            <IconChevron dir="left" />
          </Key>
          <Key className="loupe-decide" pressed={!kept} onClick={() => decide(false)} title="Leave behind (X)">
            <IconX />
            Scarta
          </Key>
          <Key className="loupe-decide loupe-decide--keep" variant="signal" pressed={kept} onClick={() => decide(true)} title="Keep (P)">
            <IconStar filled={kept} />
            Tieni
          </Key>
          <Key square onClick={() => useCull.getState().step(1)} aria-label="Next photo" title="Next (→)">
            <IconChevron dir="right" />
          </Key>
        </div>
        <span className="lcd loupe-count">
          {pos < 0 ? '—' : String(pos + 1).padStart(3, '0')}
          <span className="unit">/</span>
          {String(vis.length).padStart(3, '0')}
        </span>
      </div>
      <Filmstrip />
    </div>
  )
}

const Thumb = memo(function Thumb({ item, kept, current, onOpen }: { item: CullItem; kept: boolean; current: boolean; onOpen: (id: number) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (current) ref.current?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [current])
  return (
    <div ref={ref} className={`thumb${kept ? ' is-kept' : ''}${current ? ' is-current' : ''}`}>
      <button type="button" className="thumb-img" onClick={() => onOpen(item.id)} aria-label={`Open ${item.name}`}>
        {item.thumb ? <img src={item.thumb} alt="" draggable={false} /> : <span className="thumb-wait">{item.broken ? '×' : ''}</span>}
      </button>
      <button
        type="button"
        className="thumb-star"
        aria-pressed={kept}
        aria-label={kept ? `Unmark ${item.name}` : `Keep ${item.name}`}
        onClick={() => useCull.getState().setKeep(item.id, !kept)}
      >
        <IconStar filled={kept} />
      </button>
      <span className="thumb-name">{item.name}</span>
    </div>
  )
})

const openInLoupe = (id: number) => {
  const s = useCull.getState()
  s.go(id)
  s.setMode('loupe')
}

function Filmstrip() {
  const items = useCull((s) => s.items)
  const keep = useCull((s) => s.keep)
  const filter = useCull((s) => s.filter)
  const index = useCull((s) => s.index)
  const go = useCull((s) => s.go)
  return (
    <div className="filmstrip">
      {visibleItems({ items, keep, filter }).map((it) => (
        <Thumb key={it.id} item={it} kept={!!keep[it.id]} current={it.id === index} onOpen={go} />
      ))}
    </div>
  )
}

function ContactSheet() {
  const items = useCull((s) => s.items)
  const keep = useCull((s) => s.keep)
  const filter = useCull((s) => s.filter)
  const index = useCull((s) => s.index)
  const vis = visibleItems({ items, keep, filter })
  return (
    <div className="contact">
      {vis.length === 0 && <div className="contact-none">No photos in this view.</div>}
      {vis.map((it) => (
        <Thumb
          key={it.id}
          item={it}
          kept={!!keep[it.id]}
          current={it.id === index}
          onOpen={openInLoupe}
        />
      ))}
    </div>
  )
}
