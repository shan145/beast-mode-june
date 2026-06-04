import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

navigator.serviceWorker?.addEventListener('message', event => {
  if (event.data?.type === 'sw-navigate' && event.data.url) {
    window.location.href = event.data.url
  }
})

// When a new service worker takes over, reload to get the latest assets.
navigator.serviceWorker?.addEventListener('controllerchange', () => {
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
