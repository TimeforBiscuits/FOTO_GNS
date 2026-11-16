import { AlertDialog, ReadyDialog } from './app/Dialogs'
import { CullToolbar } from './cull/CullToolbar'
import { Curation } from './cull/Curation'
import { SaveDialog } from './cull/SaveDialog'
import { useState } from 'react'
import { Splash } from './app/Splash'
import { useView } from './store/view'
import { Sheet } from './app/Sheet'
import { StatusBar } from './app/StatusBar'
import { Toolbar } from './app/Toolbar'
import { TopBar } from './app/TopBar'

export default function App({ restored }: { restored: boolean }) {
  const view = useView((s) => s.view)
  const [splash, setSplash] = useState(true)
  return (
    <div className="app">
      <TopBar />
      <div className="main">
        {view === 'layout' ? (
          <>
            <main className="stage">
              <Sheet />
              <Legend />
            </main>
            <Toolbar />
          </>
        ) : (
          <>
            <main className="stage">
              <Curation />
            </main>
            <CullToolbar />
          </>
        )}
      </div>
      <StatusBar />
      <AlertDialog />
      <ReadyDialog />
      <SaveDialog />
      {splash && <Splash restored={restored} onDone={() => setSplash(false)} />}
    </div>
  )
}

function Legend() {
  return (
    <div className="view-badge">
      <span className="tag">
        <span className="swatch" style={{ background: '#1592a6' }} />
        Free
      </span>
      <span className="tag">
        <span className="swatch" style={{ background: '#ff4f00' }} />
        A5
      </span>
      <span className="tag">
        <span className="swatch" style={{ background: '#c8207a' }} />
        A6
      </span>
    </div>
  )
}
