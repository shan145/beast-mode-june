import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { firebaseAuth } from './middleware/auth'
import chat from './routes/chat'
import type { Env, Variables } from './types'

export { ChatRoom } from './chat/ChatRoom'

const app = new Hono<{ Bindings: Env; Variables: Variables }>()

app.use('*', cors({
  origin: [
    'http://localhost:5173',
    'https://beast-mode-cct.com',
    'https://beast-mode-c4809.web.app',
    'https://beast-mode-c4809.firebaseapp.com',
    'https://api.beast-mode-cct.com',
  ],
}))

app.get('/health', (c) => c.json({ ok: true }))

app.use('/api/*', firebaseAuth)

app.get('/api/me', (c) => c.json({ userId: c.get('userId') }))

app.route('/api/chat', chat)

export default app
