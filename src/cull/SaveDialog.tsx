import { Key } from '../ui/controls'
import { IconStar } from '../ui/icons'
import { closeSave, SHARE_BATCH, shareNextBatch, useSave } from './saveKeepers'

export function SaveDialog() {
  const phase = useSave((s) => s.phase)
  if (!phase) return null

  if (phase.kind === 'progress')
    return (
      <div className="scrim">
        <div className="dialog dialog--sm" role="dialog" aria-label="Saving">
          <header className="panel-head">
            <span className="num">…</span>
            <span className="it">ESPORTA</span>
            <span className="en">Saving</span>
          </header>
          <div className="panel-body">
            <p className="dialog-text">
              Saving {phase.done + 1} of {phase.total}…
            </p>
            <div className="meter">
              <span style={{ width: `${(phase.done / phase.total) * 100}%` }} />
            </div>
          </div>
        </div>
      </div>
    )

  if (phase.kind === 'share') {
    const total = phase.files.length
    const end = Math.min(total, phase.next + SHARE_BATCH)
    const batched = total > SHARE_BATCH
    return (
      <div className="scrim">
        <div className="dialog dialog--sm" role="dialog" aria-labelledby="share-title">
          <header className="panel-head">
            <span className="num">★</span>
            <span className="it">ESPORTA</span>
            <span className="en">Save to Files</span>
          </header>
          <div className="panel-body">
            <h2 id="share-title" className="dialog-title">
              {batched ? `Selezioni ${phase.next + 1}–${end} of ${total}` : `${total} selezion${total === 1 ? 'e' : 'i'}`}
            </h2>
            <p className="dialog-text">
              Tap Save, then choose “Save to Files” and pick the folder.
              {batched && ' Use the same folder for every batch.'}
            </p>
            {batched && (
              <div className="meter">
                <span style={{ width: `${(phase.next / total) * 100}%` }} />
              </div>
            )}
            <div className="dialog-actions">
              <Key onClick={closeSave}>Cancel</Key>
              <Key variant="signal" onClick={() => void shareNextBatch()}>
                <IconStar filled />
                Save{batched ? ' batch' : ''}
              </Key>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="scrim">
      <div className="dialog dialog--sm" role="dialog" aria-labelledby="done-title">
        <header className="panel-head">
          <span className="num">✓</span>
          <span className="it">FATTO</span>
          <span className="en">Selezioni saved</span>
        </header>
        <div className="panel-body">
          <h2 id="done-title" className="dialog-title">
            {phase.kept} kept · {phase.rejected} left behind
          </h2>
          <p className="dialog-text">{phase.how}</p>
          <p className="dialog-text">
            Nothing was deleted. Once you've checked the saved copies, delete the {phase.rejected} you didn't keep (or the whole original folder)
            yourself.
          </p>
          <div className="dialog-actions">
            <Key variant="ink" onClick={closeSave}>
              OK
            </Key>
          </div>
        </div>
      </div>
    </div>
  )
}
