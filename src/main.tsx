import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/archivo/wdth.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'
import './styles/app.css'
import App from './App.tsx'
import { restore, startAutosave } from './store/persist'

// iPad/Safari: pinches belong to the sheet, never to zooming the whole page.
document.addEventListener('gesturestart', (e) => e.preventDefault())

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined)
  })
}

// The last session comes back before the first paint of the app.
restore().finally(() => {
  startAutosave()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
