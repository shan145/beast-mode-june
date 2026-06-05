# Step 2: Auth Middleware

## What to build

A Hono middleware that verifies Firebase ID tokens on every `/api/*` route. The client sends the token as a `Bearer` header; the Worker validates it against Google's public keys and injects the `userId` into the request context.

## How Firebase JWT verification works

Firebase ID tokens are signed JWTs. The public keys are available at:
```
https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com
```
Verify the token's signature, `iss`, `aud`, and `exp` claims. No Firebase Admin SDK needed — raw JWT verification works in the Workers runtime.

## Implementation

`workers/api/src/middleware/auth.ts`:
```ts
import type { MiddlewareHandler } from 'hono'

const GOOGLE_KEYS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'

export const firebaseAuth: MiddlewareHandler = async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  if (!token) return c.json({ error: 'Unauthorized' }, 401)

  try {
    const projectId = c.env.FIREBASE_PROJECT_ID
    const keysRes = await fetch(GOOGLE_KEYS_URL)
    const keys = await keysRes.json<Record<string, string>>()

    // Decode header to find the key id
    const [headerB64] = token.split('.')
    const header = JSON.parse(atob(headerB64))
    const certPem = keys[header.kid]
    if (!certPem) return c.json({ error: 'Invalid token key' }, 401)

    // Use Web Crypto to verify
    const publicKey = await importPublicKey(certPem)
    const valid = await verifyJWT(token, publicKey, projectId)
    if (!valid) return c.json({ error: 'Invalid token' }, 401)

    const payload = JSON.parse(atob(token.split('.')[1]))
    c.set('userId', payload.sub as string)
    await next()
  } catch {
    return c.json({ error: 'Unauthorized' }, 401)
  }
}
```

Wire it up in `workers/api/src/index.ts`:
```ts
import { firebaseAuth } from './middleware/auth'

app.use('/api/*', firebaseAuth)

app.get('/api/me', (c) => c.json({ userId: c.get('userId') }))
```

## Environment variable

Add to `wrangler.toml`:
```toml
[vars]
FIREBASE_PROJECT_ID = "your-firebase-project-id"
```

## React client pattern

Every authenticated request from the React app:
```ts
import { auth } from '@/lib/firebase'

async function apiFetch(path: string, init?: RequestInit) {
  const token = await auth.currentUser?.getIdToken()
  return fetch(`${import.meta.env.VITE_WORKER_URL}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })
}
```

Add `VITE_WORKER_URL=https://beast-mode-api.<subdomain>.workers.dev` to `.env.local`.

## Done when

- `/api/me` returns `{ userId: "..." }` when called with a valid Firebase ID token
- `/api/me` returns 401 with no token or an invalid one
- `apiFetch` helper exists in the React codebase

## Next

[Step 3 — Challenges & friend requests](./03-challenges.md)
