import type { MiddlewareHandler } from 'hono'
import type { Env, Variables } from '../types'
import { verifyFirebaseToken } from '../lib/verifyToken'

// Accepts token from Authorization header (REST) or ?token= query param (WebSocket).
export const firebaseAuth: MiddlewareHandler<{ Bindings: Env; Variables: Variables }> = async (c, next) => {
  const authHeader = c.req.header('Authorization')
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : new URL(c.req.url).searchParams.get('token')

  if (!token) return c.json({ error: 'Unauthorized' }, 401)

  const userId = await verifyFirebaseToken(token, c.env.FIREBASE_PROJECT_ID)
  if (!userId) return c.json({ error: 'Unauthorized' }, 401)

  c.set('userId', userId)
  await next()
}
