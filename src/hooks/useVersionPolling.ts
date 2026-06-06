import { useEffect } from 'react'

const INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

export function useVersionPolling() {
  useEffect(() => {
    if (!import.meta.env.PROD) return

    let current: string | null = null

    async function check() {
      try {
        const res = await fetch('/version.json', { cache: 'no-store' })
        const { version } = await res.json()
        if (current === null) {
          current = version
        } else if (version !== current) {
          window.location.reload()
        }
      } catch {
        // network error — try again next interval
      }
    }

    function onVisible() {
      if (document.visibilityState === 'visible') check()
    }

    check()
    const id = setInterval(check, INTERVAL_MS)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
}
