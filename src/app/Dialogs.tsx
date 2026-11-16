import { useEffect, useRef } from 'react'
import { useDoc } from '../store/doc'
import { Key } from '../ui/controls'
import { IconPrint } from '../ui/icons'
import { deliver } from './files'

export function AlertDialog() {
  const alert = useDoc((s) => s.alert)
  const showAlert = useDoc((s) => s.showAlert)
  const ok = useRef<HTMLButtonElement>(null)
  useEffect(() => ok.current?.focus(), [alert])
  if (!alert) return null
  const close = () => showAlert(null)
  return (
    <div className="scrim" onPointerDown={(e) => e.target === e.currentTarget && close()} onKeyDown={(e) => (e.key === 'Escape' || e.key === 'Enter') && close()}>
      <div className="dialog dialog--sm" role="alertdialog" aria-labelledby="alert-title" aria-describedby="alert-body">
        <header className="panel-head">
          <span className="num">!</span>
          <span className="it">ATTENZIONE</span>
          <span className="en">{alert.title}</span>
        </header>
        <div className="panel-body">
          <h2 id="alert-title" className="dialog-title">
            {alert.title}
          </h2>
          <p id="alert-body" className="dialog-text">
            {alert.body}
          </p>
          <div className="dialog-actions">
            <Key ref={ok} variant="ink" onClick={close}>
              OK
            </Key>
          </div>
        </div>
      </div>
    </div>
  )
}

/** iPad: the finished PDF waits here so the share sheet opens from a fresh tap. */
export function ReadyDialog() {
  const ready = useDoc((s) => s.ready)
  const setReady = useDoc((s) => s.setReady)
  if (!ready) return null
  return (
    <div className="scrim">
      <div className="dialog dialog--sm" role="dialog" aria-labelledby="ready-title">
        <header className="panel-head">
          <span className="num">✓</span>
          <span className="it">PRONTO</span>
          <span className="en">PDF ready</span>
        </header>
        <div className="panel-body">
          <h2 id="ready-title" className="dialog-title">
            {ready.name}
          </h2>
          <p className="dialog-text">Tap Save, then choose “Save to Files” to pick a folder.</p>
          <div className="dialog-actions">
            <Key onClick={() => setReady(null)}>Cancel</Key>
            <Key
              variant="signal"
              onClick={() => {
                void deliver(ready)
                setReady(null)
              }}
            >
              <IconPrint />
              Save PDF
            </Key>
          </div>
        </div>
      </div>
    </div>
  )
}
