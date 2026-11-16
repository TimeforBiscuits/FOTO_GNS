import { useEffect, useRef, useState } from 'react'
import { useDoc } from '../store/doc'
import '../styles/splash.css'

// The title card, from the same 1995 Milanese studio reel as PJKT_GNS.
// A camera draws itself while the last session is restored, then the
// shutter fires: a white flash, and the app is there. Tap or press any key
// to skip.

const SEEN = 'foto_gns.splash'

const seenThisSession = () => {
  try {
    return sessionStorage.getItem(SEEN) === '1'
  } catch {
    return false
  }
}

const markSeen = () => {
  try {
    sessionStorage.setItem(SEEN, '1')
  } catch {
    // private mode: play the full title every time
  }
}

const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

const STATUS = ['OTTICA · OPTICS', 'PELLICOLA · FILM', 'PROGETTO · PROJECT', 'PRONTO · READY']

/** Ruler ticks for 0–210 mm (A4's width) at 10 units per mm. */
const ticks = (() => {
  let d = ''
  for (let mm = 0; mm <= 210; mm++) {
    const len = mm % 10 === 0 ? 26 : mm % 5 === 0 ? 16 : 9
    d += `M${mm * 10 + 1} 60V${60 - len}`
  }
  return d
})()

/** A minimal camera, drawn in a few strokes; its lens lights up before the shot. */
function Camera() {
  return (
    <svg className="sp-camera" viewBox="0 0 120 88" aria-hidden="true">
      {/* body, with the prism hump */}
      <path className="sp-stroke sp-stroke--body" pathLength={1} d="M10 26 H40 L47 15 H73 L80 26 H110 V78 H10 Z" />
      {/* shutter button and viewfinder window */}
      <path className="sp-stroke sp-stroke--bits" pathLength={1} d="M88 20 H100 M18 34 H28" />
      {/* lens: barrel and glass */}
      <circle className="sp-stroke sp-stroke--lens" pathLength={1} cx="60" cy="51" r="19" />
      <circle className="sp-glass" cx="60" cy="51" r="11" />
      <circle className="sp-glint" cx="55.5" cy="46.5" r="2.4" />
    </svg>
  )
}

function Card({ pct }: { pct: number }) {
  const status = STATUS[Math.min(STATUS.length - 1, Math.floor((pct / 100) * (STATUS.length - 1) + 0.0001))]
  return (
    <div className="sp-card">
      <div className="sp-grid" />
      <i className="sp-crop sp-crop--tl" />
      <i className="sp-crop sp-crop--tr" />
      <i className="sp-crop sp-crop--bl" />
      <i className="sp-crop sp-crop--br" />
      <header className="sp-top">
        <span>FOTO_GNS / N° 002 — EDIZIONE STUDIO</span>
        <span>MILANO · MCMXCV</span>
      </header>

      <div className="sp-title">
        <Camera />
        <h1 className="sp-word" aria-label="FOTO_GNS">
          <span className="sp-slashes">//</span>
          <span className="sp-letters">
            FOTO<em>_</em>GNS
          </span>
          <span className="sp-cursor" />
        </h1>
        <div className="sp-rule" />
        <p className="sp-sub">FOTO GANS — SELEZIONE E STAMPA</p>
      </div>

      <div className="sp-ruler">
        <div className="sp-span">
          <span>A4 · 210 × 297 MM</span>
          <span>300 DPI</span>
        </div>
        <svg viewBox="0 0 2102 62" preserveAspectRatio="none" aria-hidden="true">
          <path d="M1 60H2101" stroke="currentColor" strokeWidth="2" />
          <path d={ticks} stroke="currentColor" strokeWidth="2" />
          <path d="M101 0V62 M2001 0V62" stroke="#ff4f00" strokeWidth="3" strokeDasharray="4 5" />
        </svg>
      </div>

      <footer className="sp-bottom">
        <div className="sp-bar" aria-hidden="true">
          {['#00aeef', '#ec008c', '#fff200', '#111', '#ff4f00', '#808080', '#fff'].map((c, i) => (
            <i key={c} style={{ background: c, animationDelay: `${0.95 + i * 0.06}s` }} />
          ))}
        </div>
        <div className="sp-lcd">
          <span className="sp-lcd-label">{status}</span>
          <span className="sp-lcd-num">
            {String(Math.round(pct)).padStart(3, '0')}
            <small>%</small>
          </span>
        </div>
      </footer>
    </div>
  )
}

export function Splash({ restored, onDone }: { restored: boolean; onDone: () => void }) {
  const [quick] = useState(() => seenThisSession() || reducedMotion())
  const [pct, setPct] = useState(quick ? 100 : 0)
  const [exiting, setExiting] = useState(false)
  const done = useRef(false)

  useEffect(() => {
    if (quick) return
    const start = performance.now()
    let raf = 0
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / 1700)
      setPct((p) => Math.max(p, (1 - Math.pow(1 - t, 2.2)) * 100))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [quick])

  const leave = () => {
    if (done.current) return
    done.current = true
    markSeen()
    setExiting(true)
    setTimeout(
      () => {
        onDone()
        if (restored) useDoc.getState().say('Bentornato — welcome back. Your last layout is restored.')
      },
      reducedMotion() ? 200 : 700,
    )
  }

  // Open once the count reaches 100, after a beat.
  useEffect(() => {
    if (pct < 100) return
    const t = setTimeout(leave, quick ? 450 : 350)
    return () => clearTimeout(t)
  })

  // Any tap or key skips.
  useEffect(() => {
    const skip = () => leave()
    window.addEventListener('pointerdown', skip)
    window.addEventListener('keydown', skip)
    return () => {
      window.removeEventListener('pointerdown', skip)
      window.removeEventListener('keydown', skip)
    }
  })

  const cls = ['splash']
  if (quick) cls.push('is-quick')
  if (exiting) cls.push('is-exit')
  if (reducedMotion()) cls.push('is-still')

  return (
    <div className={cls.join(' ')} role="status" aria-label="Loading FOTO_GNS">
      <Card pct={pct} />
      <div className="sp-flash" aria-hidden="true" />
    </div>
  )
}
