import { keepCount, useCull, type CullFilter, type CullMode } from '../store/cull'
import { Key, Panel, Segmented, Toggle } from '../ui/controls'
import { IconFolder, IconImage, IconStar, IconX } from '../ui/icons'
import { canPickFolder, closePhotos, openPhotos } from './open'
import { saveKeepers, saveMethod, SHARE_BATCH } from './saveKeepers'

export function CullToolbar() {
  const count = useCull((s) => s.items.length)
  return (
    <aside className="inspector" aria-label="Curation">
      <SourcePanel />
      {count > 0 && <KeepersPanel />}
      {count > 0 && <SavePanel />}
    </aside>
  )
}

function SourcePanel() {
  const source = useCull((s) => s.source)
  const count = useCull((s) => s.items.length)
  const thumbs = useCull((s) => s.items.reduce((n, it) => n + (it.thumb || it.broken ? 1 : 0), 0))
  const folder = canPickFolder()
  return (
    <Panel num="01" it="CARTELLA" en="Source">
      {count > 0 && (
        <dl className="spec">
          <dt>Opened</dt>
          <dd className="ellipsis" title={source}>
            {source}
          </dd>
          <dt>JPGs</dt>
          <dd>{count}</dd>
          <dt>Previews</dt>
          <dd>{thumbs === count ? 'ready' : `${thumbs} / ${count}`}</dd>
        </dl>
      )}
      <div className={folder ? 'grid-2' : 'size-list'}>
        {folder && (
          <Key onClick={() => void openPhotos(true)}>
            <IconFolder />
            Folder
          </Key>
        )}
        <Key onClick={() => void openPhotos(false)}>
          <IconImage />
          {folder ? 'JPGs' : 'Open JPGs from Files'}
        </Key>
      </div>
      {count > 0 && (
        <Key
          size="sm"
          onClick={() => {
            const s = useCull.getState()
            if (keepCount(s.keep) && !s.exported && !window.confirm('Close these photos? Your selezioni are remembered for next time, but not saved anywhere yet.')) return
            closePhotos()
          }}
        >
          <IconX />
          Close
        </Key>
      )}
    </Panel>
  )
}

function KeepersPanel() {
  const count = useCull((s) => s.items.length)
  const kept = useCull((s) => keepCount(s.keep))
  const seen = useCull((s) => Object.keys(s.seen).length)
  const mode = useCull((s) => s.mode)
  const filter = useCull((s) => s.filter)
  const auto = useCull((s) => s.autoAdvance)
  const { setMode, setFilter, setAutoAdvance, clearKeep } = useCull.getState()

  return (
    <Panel num="02" it="SELEZIONI" en="Keepers">
      <dl className="spec">
        <dt>Seen</dt>
        <dd>
          {seen} / {count}
        </dd>
        <dt>Selezioni</dt>
        <dd className="spec-keep">{kept}</dd>
        <dt>Left behind</dt>
        <dd>{count - kept}</dd>
      </dl>
      <label className="field">
        <span className="field-label">View</span>
        <Segmented<CullMode>
          label="View"
          fill
          size="sm"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'loupe', label: 'Loupe', title: 'One photo at a time (Enter)' },
            { value: 'grid', label: 'Grid', title: 'Contact sheet (G)' },
          ]}
        />
      </label>
      <label className="field">
        <span className="field-label">Show</span>
        <Segmented<CullFilter>
          label="Show"
          fill
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'keep', label: 'Selezioni' },
            { value: 'reject', label: 'The rest' },
          ]}
        />
      </label>
      <Toggle on={auto} onChange={setAutoAdvance}>
        Next photo after deciding
      </Toggle>
      <dl className="keys-help">
        <dt>P</dt>
        <dd>keep</dd>
        <dt>X</dt>
        <dd>leave behind</dd>
        <dt>Space</dt>
        <dd>toggle</dd>
        <dt>← →</dt>
        <dd>previous · next</dd>
        <dt>G</dt>
        <dd>grid / loupe</dd>
      </dl>
      <p className="note">On iPad: swipe to move, double-tap to keep. Selezioni are remembered if you open the same photos again.</p>
      <Key
        size="sm"
        disabled={!kept}
        onClick={() => window.confirm(`Unmark all ${kept} selezioni?`) && clearKeep()}
      >
        Clear selezioni
      </Key>
    </Panel>
  )
}

function SavePanel() {
  const kept = useCull((s) => keepCount(s.keep))
  const count = useCull((s) => s.items.length)
  const exported = useCull((s) => s.exported)
  const method = saveMethod()
  const how = {
    folder: 'Choose a folder (a new, empty one is best). Exact copies of your selezioni are saved there.',
    share: `The share sheet opens. Choose “Save to Files” and pick a folder. ${kept > SHARE_BATCH ? `More than ${SHARE_BATCH} are saved in batches, one tap each.` : ''}`,
    zip: 'Your selezioni download as one .zip of exact copies. In Chrome you could pick a folder instead.',
  }[method]
  return (
    <Panel num="03" it="ESPORTA" en="Save keepers">
      <p className="note">{how}</p>
      <Key variant="signal" className="export-key" disabled={!kept} onClick={() => void saveKeepers()}>
        <IconStar filled />
        Save {kept} selezion{kept === 1 ? 'e' : 'i'}
      </Key>
      <div className={exported ? 'warn warn--ok' : 'warn'}>
        <b>{exported ? '✓' : '!'}</b>
        <span>
          {exported
            ? `Saved. The ${count - kept} photo${count - kept === 1 ? '' : 's'} you didn't keep are still in the original folder: delete it, or them, yourself in ${method === 'share' ? 'Files' : 'Finder'}.`
            : 'FOTO_GNS never deletes anything. Once your selezioni are saved, delete the originals yourself.'}
        </span>
      </div>
    </Panel>
  )
}
