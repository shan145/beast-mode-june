import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data?.type === 'sw-navigate' && event.data.url) {
      window.location.href = event.data.url
    }
  })

  // When a new service worker takes over, reload to get the latest assets.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload()
  })

  // Always register so update detection works regardless of push permission.
  // updateViaCache: 'none' bypasses HTTP cache when checking for a new SW version.
  navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
