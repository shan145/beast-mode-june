import { vapidAuthorization, encryptPushPayload, type PushSubscription } from './crypto'

interface Env {
  PUSH_KV: KVNamespace
  VAPID_PRIVATE_KEY_JWK: string  // JSON string of a JWK EC private key
  VAPID_PUBLIC_KEY: string       // base64url uncompressed P-256 public key (87 chars)
  VAPID_SUBJECT: string          // mailto: or https:// contact URI
  FIREBASE_API_KEY: string       // Firebase Web API key (for ID token verification)
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

// Verify a Firebase ID token via the REST API and return the uid, or null on failure
async function verifyToken(idToken: string, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) },
    )
    if (!res.ok) {
      const errBody = await res.text().catch(() => '(unreadable)')
      console.error(`verifyToken: identitytoolkit returned ${res.status}:`, errBody)
      return null
    }
    const data = await res.json() as { users?: { localId: string }[] }
    return data.users?.[0]?.localId ?? null
  } catch (e) {
    console.error('verifyToken: exception', e)
    return null
  }
}

// Send a single encrypted push notification; returns whether the subscription is stale
async function sendPush(
  sub: PushSubscription,
  payload: NotificationPayload,
  env: Env,
): Promise<{ expired: boolean }> {
  const body = await encryptPushPayload(JSON.stringify(payload), sub)
  const auth = await vapidAuthorization(
    sub.endpoint,
    env.VAPID_SUBJECT,
    JSON.parse(env.VAPID_PRIVATE_KEY_JWK) as JsonWebKey,
    env.VAPID_PUBLIC_KEY,
  )
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': auth,
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'TTL': '86400',
      'Urgency': 'normal',
    },
    body,
  })
  if (!res.ok) {
    const errBody = await res.text().catch(() => '(unreadable)')
    console.error(`sendPush: push endpoint returned ${res.status}:`, errBody)
  }
  return { expired: res.status === 404 || res.status === 410 }
}

// Fan out a notification to either specific recipients or all except one
async function fanOut(
  payload: NotificationPayload,
  env: Env,
  opts: { recipientIds?: string[]; excludeUserId?: string },
): Promise<void> {
  let kvKeys: string[]

  if (opts.recipientIds && opts.recipientIds.length > 0) {
    kvKeys = opts.recipientIds.map(id => `sub_${id}`)
  } else {
    const list = await env.PUSH_KV.list({ prefix: 'sub_' })
    kvKeys = list.keys
      .map(k => k.name)
      .filter(k => !opts.excludeUserId || k !== `sub_${opts.excludeUserId}`)
  }

  console.log('[fanOut] keys to notify:', kvKeys)
  await Promise.all(
    kvKeys.map(async key => {
      const raw = await env.PUSH_KV.get(key)
      if (!raw) { console.log('[fanOut] no subscription found for key:', key); return }
      let sub: PushSubscription
      try { sub = JSON.parse(raw) as PushSubscription } catch { console.log('[fanOut] bad subscription JSON for key:', key); return }
      console.log('[fanOut] sending push to endpoint:', sub.endpoint.slice(0, 60))
      const { expired } = await sendPush(sub, payload, env)
      console.log('[fanOut] result for', key, '— expired:', expired)
      if (expired) await env.PUSH_KV.delete(key)
    }),
  )
}

interface NotificationPayload {
  title: string
  body: string
  tag: string
  data?: Record<string, string>
}

function buildPayload(type: string, p: Record<string, unknown>): NotificationPayload | null {
  const name = (p.userName as string | undefined) ?? 'Someone'
  switch (type) {
    case 'feed-post':
      return { title: 'Beast Mode', body: `${name} posted to the feed`, tag: `feed-post-${p.postId ?? Date.now()}`, data: { url: '/?tab=feed' } }
    case 'feed-reaction':
      return { title: 'Beast Mode', body: `${name} reacted to your post ${p.emoji ?? ''}`, tag: `reaction-${p.postId}-${p.reactorId ?? name}`, data: { url: `/?tab=feed&post=${p.postId}` } }
    case 'feed-comment':
      return { title: 'Beast Mode', body: `${name} commented on a post`, tag: `comment-${p.postId}-${p.commenterId ?? name}`, data: { url: `/?tab=feed&post=${p.postId}` } }
    case 'daily-complete':
      return { title: 'Beast Mode', body: `${name} crushed all their tasks today!`, tag: `daily-${p.date}-${p.userId ?? ''}`, data: { url: p.userId ? `/member/${p.userId}` : '/' } }
    case 'weekly-complete':
      return { title: 'Beast Mode', body: `${name} completed all goals for the week!`, tag: `weekly-${p.weekStart}-${p.userId ?? ''}`, data: { url: p.userId ? `/member/${p.userId}` : '/' } }
    case 'gift-sent': {
      const toName = (p.toName as string | undefined) ?? 'You'
      return { title: 'Beast Mode', body: `${name} sent you a beast kudos`, tag: `gift-${p.toUserId ?? ''}-${p.fromUserId ?? name}`, data: { url: `/?tab=feed&celebration=${encodeURIComponent(toName)}` } }
    }
    case 'celebration-sent': {
      const toName = (p.toName as string | undefined) ?? 'You'
      return { title: 'Beast Mode', body: `${name} is cheering you on! 🎆`, tag: `celebration-${p.toUserId ?? ''}-${p.fromUserId ?? name}`, data: { url: `/?tab=feed&fireworks=${encodeURIComponent(toName)}` } }
    }
    default:
      return null
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
    if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405)

    // Authenticate every POST with a Firebase ID token
    const bearer = request.headers.get('Authorization') ?? ''
    const idToken = bearer.startsWith('Bearer ') ? bearer.slice(7) : ''
    const userId = idToken ? await verifyToken(idToken, env.FIREBASE_API_KEY) : null
    if (!userId) return json({ error: 'unauthorized' }, 401)

    let body: Record<string, unknown>
    try { body = await request.json() as Record<string, unknown> } catch { return json({ error: 'invalid json' }, 400) }

    const { pathname } = new URL(request.url)

    // Save push subscription for this user
    if (pathname === '/subscribe') {
      const sub = body.subscription as PushSubscription | undefined
      if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
        return json({ error: 'invalid subscription' }, 400)
      }
      await env.PUSH_KV.put(`sub_${userId}`, JSON.stringify(sub))
      return json({ ok: true })
    }

    // Remove push subscription for this user
    if (pathname === '/unsubscribe') {
      await env.PUSH_KV.delete(`sub_${userId}`)
      return json({ ok: true })
    }

    // Send a notification
    if (pathname === '/notify') {
      const type = body.type as string | undefined
      const payload = (body.payload ?? {}) as Record<string, unknown>
      if (!type) return json({ error: 'missing type' }, 400)

      // Idempotency: daily-complete fires once per user per day
      if (type === 'daily-complete') {
        const date = payload.date as string
        if (!date) return json({ error: 'missing date' }, 400)
        const key = `daily_notified_${userId}_${date}`
        if (await env.PUSH_KV.get(key)) return json({ ok: true, skipped: true })
        await env.PUSH_KV.put(key, '1', { expirationTtl: 60 * 60 * 24 * 3 })
      }

      // Idempotency: weekly-complete fires once per user per week
      if (type === 'weekly-complete') {
        const weekStart = payload.weekStart as string
        if (!weekStart) return json({ error: 'missing weekStart' }, 400)
        const key = `weekly_notified_${userId}_${weekStart}`
        if (await env.PUSH_KV.get(key)) return json({ ok: true, skipped: true })
        await env.PUSH_KV.put(key, '1', { expirationTtl: 60 * 60 * 24 * 10 })
      }

      const notification = buildPayload(type, payload)
      if (!notification) return json({ error: `unknown type: ${type}` }, 400)

      const recipientIds = body.recipientIds as string[] | undefined
      const excludeUserId = body.excludeUserId as string | undefined

      await fanOut(notification, env, { recipientIds, excludeUserId })
      return json({ ok: true })
    }

    return json({ error: 'not found' }, 404)
  },
}
