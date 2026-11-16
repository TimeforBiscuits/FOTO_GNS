import type { ReactNode } from 'react'
import { RATIOS, type RatioId } from '../model/layout'

// Icons drawn on a 24-unit grid with 2-unit square-capped strokes,
// in the manner of a 90s technical manual — the same hand as PJKT_GNS.

const Svg = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true">
    {children}
  </svg>
)

export const IconImage = () => (
  <Svg>
    <rect x="3" y="4" width="18" height="16" />
    <path d="M3 17 L9 11 L13 15 L16 12 L21 17" />
    <rect x="15" y="7" width="2.5" height="2.5" fill="currentColor" stroke="none" />
  </Svg>
)

export const IconPlus = () => (
  <Svg>
    <path d="M6 12 H18 M12 6 V18" strokeWidth={2.5} />
  </Svg>
)

export const IconTrash = () => (
  <Svg>
    <path d="M4 6 H20 M9 6 V3.5 H15 V6 M6.5 6 L7.5 21 H16.5 L17.5 6 M10 10 V17 M14 10 V17" />
  </Svg>
)

export const IconUnlink = () => (
  <Svg>
    <rect x="3" y="4" width="18" height="16" strokeDasharray="3 2.5" />
    <path d="M8 9 L16 15 M16 9 L8 15" />
  </Svg>
)

export const IconPrint = () => (
  <Svg>
    <path d="M7 9 V3 H17 V9" />
    <rect x="3" y="9" width="18" height="8" />
    <path d="M7 14 H17 V21 H7 Z" fill="var(--chassis, #fff)" />
    <path d="M9.5 17.5 H14.5" strokeWidth={1.5} />
  </Svg>
)

export const IconLock = () => (
  <Svg>
    <rect x="5" y="11" width="14" height="10" />
    <path d="M8 11 V7.5 a4 4 0 0 1 8 0 V11" />
  </Svg>
)

export const IconChevron = ({ dir }: { dir: 'left' | 'right' }) => (
  <Svg>
    <path d={dir === 'left' ? 'M15 5 L8 12 L15 19' : 'M9 5 L16 12 L9 19'} strokeWidth={2.5} />
  </Svg>
)

/** The ratio's own shape, as large as the 24-unit box allows. */
export const IconRatio = ({ ratio }: { ratio: RatioId }) => {
  const { w, h } = RATIOS[ratio]
  const k = 18 / Math.max(w, h)
  const rw = w * k
  const rh = h * k
  return (
    <Svg>
      <rect x={12 - rw / 2} y={12 - rh / 2} width={rw} height={rh} />
    </Svg>
  )
}
