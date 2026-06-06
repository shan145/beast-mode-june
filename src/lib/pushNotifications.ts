import { auth } from './firebase'

const WORKER_URL = import.meta.env.VITE_NOTIFICATIONS_WORKER_URL as string
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string

function urlBase64ToUint8Array(b64u: string): ArrayBuffer {
  const b64 = b64u.replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64 + '='.repeat((4 - b64.length % 4) % 4))
  return Uint8Array.from(raw, c => c.charCodeAt(0)).buffer
}

async function getIdToken(): Promise<string | null> {
  return auth.currentUser?.getIdToken() ?? null
}

// Register the service worker and subscribe to push; save the subscription to the Worker.
// Returns true on success, false if permission denied or not supported.
export async function registerPushSubscription(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
  if (!WORKER_URL || !VAPID_PUBLIC_KEY) return false

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return false

  try {
    // Reuse the registration that main.tsx already created; fall back to registering
    // here only if it somehow wasn't registered yet (e.g. in a test environment).
    const reg = await navigator.serviceWorker.getRegistration('/sw.js')
      ?? await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
    // If a new version is waiting (paused state), tell it to activate immediately.
    if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' })
    await navigator.serviceWorker.ready

    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
    }

    const idToken = await getIdToken()
    if (!idToken) return false

    const res = await fetch(`${WORKER_URL}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    })

    // If KV save failed and we have a stale subscription, clear it so next
    // mount gets a fresh endpoint rather than retrying the dead one forever.
    if (!res.ok) await sub.unsubscribe()

    return res.ok
  } catch {
    return false
  }
}

export type NotificationType =
  | 'feed-post'
  | 'feed-reaction'
  | 'feed-comment'
  | 'daily-complete'
  | 'weekly-complete'
  | 'gift-sent'
  | 'celebration-sent'

interface NotifyOptions {
  recipientIds?: string[]   // notify only these users
  excludeUserId?: string    // notify everyone except this user
}

// Fire-and-forget: call Worker /notify. Errors are silently swallowed.
export async function sendNotification(
  type: NotificationType,
  payload: Record<string, unknown>,
  opts: NotifyOptions = {},
): Promise<void> {
  if (!WORKER_URL) return
  const idToken = await getIdToken()
  if (!idToken) return

  fetch(`${WORKER_URL}/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
    body: JSON.stringify({ type, payload, ...opts }),
  }).catch(() => {})
}
