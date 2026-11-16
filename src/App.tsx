import { AlertDialog, ReadyDialog } from './app/Dialogs'
import { Sheet } from './app/Sheet'
import { StatusBar } from './app/StatusBar'
import { Toolbar } from './app/Toolbar'
import { TopBar } from './app/TopBar'

export default function App() {
  return (
    <div className="app">
      <TopBar />
      <div className="main">
        <main className="stage">
          <Sheet />
          <Legend />
        </main>
        <Toolbar />
      </div>
      <StatusBar />
      <AlertDialog />
      <ReadyDialog />
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
