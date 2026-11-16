import { useState } from 'react'
import {
  PRESET_BOX,
  PRINT_DPI,
  RATIO_IDS,
  RATIOS,
  AREA,
  effectiveDpi,
  fmtMm,
  freeStartSize,
  presetSize,
  type SizeId,
} from '../model/layout'
import { exportPdf } from '../pdf/export'
import { useActivePage, useDoc, useSelectedField, type Field } from '../store/doc'
import { Key, LcdField, Led, Panel } from '../ui/controls'
import { IconImage, IconLock, IconPlus, IconPrint, IconRatio, IconTrash, IconUnlink } from '../ui/icons'
import { attachTo } from './attach'
import { SIZE_COLOR } from './colors'
import { cleanFileName } from './files'

export function Toolbar() {
  const field = useSelectedField()
  return (
    <aside className="inspector" aria-label="Toolbar">
      <RatioPanel />
      <SizePanel />
      {field && <FieldPanel key={field.id} field={field} />}
      <PagesPanel />
      <PrintPanel />
    </aside>
  )
}

function RatioPanel() {
  const ratio = useDoc((s) => s.ratio)
  const setRatio = useDoc((s) => s.setRatio)
  return (
    <Panel num="01" it="FORMATO" en="Aspect ratio">
      <div className="ratio-grid">
        {RATIO_IDS.map((id) => (
          <Key key={id} className="ratio-key" pressed={ratio === id} onClick={() => setRatio(id)} title={`${RATIOS[id].label} fields`}>
            <Led on={ratio === id} />
            <IconRatio ratio={id} />
            {RATIOS[id].label}
          </Key>
        ))}
      </div>
    </Panel>
  )
}

function SizePanel() {
  const ratio = useDoc((s) => s.ratio)
  const addField = useDoc((s) => s.addField)
  const free = freeStartSize(ratio)
  const row = (size: SizeId, name: string, sub: string, dims: { w: number; h: number }, title: string) => (
    <Key className="size-key" onClick={() => addField(size)} title={title}>
      <span className="size-chip" style={{ background: SIZE_COLOR[size] }} />
      <span className="stack">
        <span>{name}</span>
        <span className="sub">{sub}</span>
      </span>
      <span className="size-dims">
        {fmtMm(dims.w)}×{fmtMm(dims.h)}
        <small>mm</small>
      </span>
      {size === 'free' ? <IconPlus /> : <IconLock />}
    </Key>
  )
  return (
    <Panel num="02" it="MISURA" en="Size · add field">
      <div className="size-list">
        {row('free', 'Free', 'drag corners to size', free, `Add a ${RATIOS[ratio].label} field you can resize`)}
        {row('a5', 'A5', PRESET_BOX.a5.note, presetSize(ratio, 'a5'), `Add a fixed ${RATIOS[ratio].label} field for an A5 notebook`)}
        {row('a6', 'A6', PRESET_BOX.a6.note, presetSize(ratio, 'a6'), `Add a fixed ${RATIOS[ratio].label} field for an A6 notebook`)}
      </div>
      <p className="note">
        Or <b>drag on the empty grid</b> to draw a {RATIOS[ratio].label} field. Fields snap to the 5 mm grid; hold <b>⌥</b> to place freely.
      </p>
    </Panel>
  )
}

function FieldPanel({ field }: { field: Field }) {
  const asset = useDoc((s) => (field.photo ? s.assets[field.photo.assetId] : undefined))
  const updateField = useDoc((s) => s.updateField)
  const deleteField = useDoc((s) => s.deleteField)
  const removePhoto = useDoc((s) => s.removePhoto)
  const locked = field.size !== 'free'
  const dpi = field.photo ? effectiveDpi(field.photo.pxW, field.w) : null
  const r = RATIOS[field.ratio]

  return (
    <Panel num="03" it="CAMPO" en={locked ? `${field.size.toUpperCase()} · fixed size` : 'Field · free size'}>
      <dl className="spec">
        <dt>Ratio</dt>
        <dd>{r.label}</dd>
        <dt>Size</dt>
        <dd>
          {fmtMm(field.w)} × {fmtMm(field.h)} mm
        </dd>
        {locked && (
          <>
            <dt>Notebook</dt>
            <dd>
              {PRESET_BOX[field.size as 'a5' | 'a6'].name} · {PRESET_BOX[field.size as 'a5' | 'a6'].page}
            </dd>
          </>
        )}
        {field.photo && (
          <>
            <dt>Photo</dt>
            <dd className="ellipsis" title={field.photo.name}>
              {field.photo.name}
            </dd>
            <dt>Pixels</dt>
            <dd>
              {field.photo.pxW} × {field.photo.pxH}
            </dd>
            <dt>Prints at</dt>
            <dd>{Math.min(dpi!, PRINT_DPI)} dpi</dd>
          </>
        )}
      </dl>

      <div className="grid-2">
        <LcdField label="X" unit="mm" value={field.x - AREA.x} decimals={1} step={5} min={0} max={AREA.w - field.w} onChange={(v) => updateField(field.id, { x: AREA.x + v })} />
        <LcdField label="Y" unit="mm" value={field.y - AREA.y} decimals={1} step={5} min={0} max={AREA.h - field.h} onChange={(v) => updateField(field.id, { y: AREA.y + v })} />
      </div>

      {!locked && (
        <LcdField
          label="Width (height follows)"
          unit="mm"
          value={field.w}
          decimals={1}
          step={5}
          min={15}
          max={Math.min(AREA.x + AREA.w - field.x, (AREA.y + AREA.h - field.y) * (r.w / r.h))}
          onChange={(w) => updateField(field.id, { w, h: Math.round((w * r.h * 100) / r.w) / 100 })}
        />
      )}

      {dpi !== null && dpi < 200 && (
        <div className="warn">
          <b>!</b>
          <span>
            This photo has {dpi} dpi at this size, under the {PRINT_DPI} the PDF is made at. It will print, but may look soft.
          </span>
        </div>
      )}
      {locked && (
        <p className="note">
          <b>Fixed size.</b> Pre-registered fields can be moved but not resized, so they always fit the notebook.
        </p>
      )}

      <div className="grid-2">
        <Key onClick={() => void attachTo(field)}>
          <IconImage />
          {asset ? 'Replace' : 'Attach'}
        </Key>
        <Key onClick={() => removePhoto(field.id)} disabled={!field.photo}>
          <IconUnlink />
          Clear
        </Key>
      </div>
      <Key onClick={() => deleteField(field.id)}>
        <IconTrash />
        Delete field
      </Key>
    </Panel>
  )
}

function PagesPanel() {
  const pages = useDoc((s) => s.pages)
  const active = useDoc((s) => s.activePage)
  const setActivePage = useDoc((s) => s.setActivePage)
  const addPage = useDoc((s) => s.addPage)
  const deletePage = useDoc((s) => s.deletePage)
  const page = useActivePage()

  const removeActive = () => {
    if (page.fields.length && !window.confirm(`Delete page ${String(active + 1).padStart(2, '0')} and its ${page.fields.length} field(s)?`)) return
    deletePage(active)
  }

  return (
    <Panel num="04" it="PAGINE" en={`Pages · ${pages.length}`}>
      <div className="page-list">
        {pages.map((p, i) => {
          const photos = p.fields.filter((f) => f.photo).length
          return (
            <Key key={p.id} className="page-key" pressed={i === active} onClick={() => setActivePage(i)}>
              <PageThumb fields={p.fields} />
              <span className="stack">
                <span>Page {String(i + 1).padStart(2, '0')}</span>
                <span className="sub">
                  {p.fields.length} field{p.fields.length === 1 ? '' : 's'} · {photos} photo{photos === 1 ? '' : 's'}
                </span>
              </span>
            </Key>
          )
        })}
      </div>
      <div className="grid-2">
        <Key onClick={addPage}>
          <IconPlus />
          Add page
        </Key>
        <Key onClick={removeActive} disabled={pages.length === 1 && page.fields.length === 0}>
          <IconTrash />
          Delete
        </Key>
      </div>
    </Panel>
  )
}

function PageThumb({ fields }: { fields: Field[] }) {
  return (
    <svg className="page-thumb" viewBox="0 0 210 297" aria-hidden="true">
      <rect width="210" height="297" fill="#fff" />
      {fields.map((f) => (
        <rect key={f.id} x={f.x} y={f.y} width={f.w} height={f.h} fill={f.photo ? '#3d3a34' : SIZE_COLOR[f.size]} opacity={f.photo ? 1 : 0.55} />
      ))}
    </svg>
  )
}

function PrintPanel() {
  const fileName = useDoc((s) => s.fileName)
  const setFileName = useDoc((s) => s.setFileName)
  const pages = useDoc((s) => s.pages)
  const exporting = useDoc((s) => s.exporting)
  const [draft, setDraft] = useState<string | null>(null)
  const photos = pages.reduce((n, p) => n + p.fields.filter((f) => f.photo).length, 0)

  return (
    <Panel num="05" it="STAMPA" en="Export PDF">
      <label className="field">
        <span className="field-label">File name</span>
        <span className="lcd">
          <input
            value={draft ?? fileName}
            placeholder="FOTO_GNS-date"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              if (draft !== null) setFileName(cleanFileName(draft))
              setDraft(null)
            }}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
          <span className="unit">.pdf</span>
        </span>
      </label>
      <dl className="spec">
        <dt>Paper</dt>
        <dd>A4 · 210 × 297</dd>
        <dt>Pages</dt>
        <dd>{pages.length}</dd>
        <dt>Photos</dt>
        <dd>{photos}</dd>
        <dt>Resolution</dt>
        <dd>{PRINT_DPI} dpi</dd>
      </dl>
      <Key variant="signal" className="export-key" onClick={() => void exportPdf()} disabled={exporting}>
        <IconPrint />
        {exporting ? 'Working…' : 'Export PDF'}
      </Key>
      <p className="note">
        Print on A4 photo paper at <b>100 % / Actual size</b> — turn off “Fit to page” so every photo prints at its true size.
      </p>
    </Panel>
  )
}
