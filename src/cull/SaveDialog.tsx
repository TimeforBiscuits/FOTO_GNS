import { Key } from '../ui/controls'
import { IconFolder } from '../ui/icons'
import { closeSave, shareSelects, useSave } from './saveKeepers'

export function SaveDialog() {
  const phase = useSave((s) => s.phase)
  if (!phase) return null

  if (phase.kind === 'progress')
    return (
      <div className="scrim">
        <div className="dialog dialog--sm" role="dialog" aria-label="Creating SELECTS">
          <header className="panel-head">
            <span className="num">…</span>
            <span className="it">SELECTS</span>
            <span className="en">Working</span>
          </header>
          <div className="panel-body">
            <p className="dialog-text">
              {phase.label}: {Math.min(phase.done + 1, phase.total)} of {phase.total}…
            </p>
            <div className="meter">
              <span style={{ width: `${(phase.done / phase.total) * 100}%` }} />
            </div>
          </div>
        </div>
      </div>
    )

  if (phase.kind === 'share')
    return (
      <div className="scrim">
        <div className="dialog dialog--sm" role="dialog" aria-labelledby="share-title">
          <header className="panel-head">
            <span className="num">★</span>
            <span className="it">SELECTS</span>
            <span className="en">Save to Files</span>
          </header>
          <div className="panel-body">
            <h2 id="share-title" className="dialog-title">
              SELECTS.zip is ready
            </h2>
            <p className="dialog-text">
              Tap Save, choose “Save to Files” and pick where SELECTS should go. Then, in Files, tap SELECTS.zip once: it opens into the
              SELECTS folder.
            </p>
            <div className="dialog-actions">
              <Key onClick={closeSave}>Cancel</Key>
              <Key variant="signal" onClick={() => void shareSelects()}>
                <IconFolder />
                Save
              </Key>
            </div>
          </div>
        </div>
      </div>
    )

  return (
    <div className="scrim">
      <div className="dialog dialog--sm" role="dialog" aria-labelledby="done-title">
        <header className="panel-head">
          <span className="num">✓</span>
          <span className="it">FATTO</span>
          <span className="en">SELECTS created</span>
        </header>
        <div className="panel-body">
          <h2 id="done-title" className="dialog-title">
            {phase.kept} in SELECTS · {phase.rejected} left behind
          </h2>
          <p className="dialog-text">{phase.how}</p>
          <p className="dialog-text">
            Nothing was deleted. Once you've checked SELECTS, delete the originals yourself: the {phase.rejected} you didn't keep, or the whole
            original folder.
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
