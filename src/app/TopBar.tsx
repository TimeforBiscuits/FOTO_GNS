import { exportPdf } from '../pdf/export'
import { useDoc } from '../store/doc'
import { createSelects } from '../cull/saveKeepers'
import { keepCount, useCull } from '../store/cull'
import { useView, type ViewId } from '../store/view'
import { Key, Segmented } from '../ui/controls'
import { IconChevron, IconFolder, IconPlus, IconPrint } from '../ui/icons'

export function TopBar() {
  const count = useDoc((s) => s.pages.length)
  const active = useDoc((s) => s.activePage)
  const setActivePage = useDoc((s) => s.setActivePage)
  const addPage = useDoc((s) => s.addPage)
  const exporting = useDoc((s) => s.exporting)
  const pad = (n: number) => String(n).padStart(2, '0')
  const view = useView((s) => s.view)
  const setView = useView((s) => s.setView)

  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-word">
          <b>
            <i className="slashes">//</i>FOTO<i>_</i>GNS
          </b>
          <small>Foto Gans · Photo Sheets</small>
        </div>
      </div>

      <div className="topbar-group">
        <span className="topbar-label">Vista</span>
        <Segmented<ViewId>
          label="Section"
          value={view}
          onChange={setView}
          options={[
            { value: 'cull', label: 'Selezione', sub: 'curation' },
            { value: 'layout', label: 'Impaginazione', sub: 'layout' },
          ]}
        />
      </div>

      {view === 'layout' && (
      <div className="topbar-group" role="group" aria-label="Page">
        <span className="topbar-label">Pagina</span>
        <Key square size="sm" onClick={() => setActivePage(active - 1)} disabled={active === 0} aria-label="Previous page">
          <IconChevron dir="left" />
        </Key>
        <span className="lcd page-lcd" aria-live="polite">
          {pad(active + 1)}
          <span className="unit">/</span>
          {pad(count)}
        </span>
        <Key square size="sm" onClick={() => setActivePage(active + 1)} disabled={active === count - 1} aria-label="Next page">
          <IconChevron dir="right" />
        </Key>
        <Key size="sm" onClick={addPage} title="Add an A4 page">
          <IconPlus />
          Page
        </Key>
      </div>
      )}

      <div className="spacer" />

      {view === 'cull' && <SelectsKey />}

      {view === 'layout' && (
      <Key variant="signal" onClick={() => void exportPdf()} disabled={exporting} title="Export a 300 dpi PDF">
        <IconPrint />
        Stampa
      </Key>
      )}
    </header>
  )
}

/** The cull, always in reach: every selezione into a SELECTS folder. */
function SelectsKey() {
  const kept = useCull((s) => keepCount(s.keep))
  const count = useCull((s) => s.items.length)
  if (!count) return null
  return (
    <Key variant="signal" onClick={() => void createSelects()} disabled={!kept} title="Copy every selezione into a folder called SELECTS">
      <IconFolder />
      SELECTS
      <span className="selects-count">{kept}</span>
    </Key>
  )
}
