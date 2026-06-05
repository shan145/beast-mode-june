# Step 4: Real-Time Chat (Durable Objects)

## What to build

A WebSocket-based group chat (and optionally DM threads). Each chat room is one Durable Object — it holds all active WebSocket connections in memory and fans messages out to every connected client, persisting the message history to DO storage.

## How Durable Objects fit here

A regular Worker is stateless — it can't hold WebSocket connections across requests. A Durable Object is a single-instance stateful class: one instance per room ID, always the same instance regardless of which edge node the request hits. All connections for a room go to the same DO, so fanout is just iterating over `this.sessions`.

## DO class

`workers/api/src/chat/ChatRoom.ts`:
```ts
import { DurableObject } from 'cloudflare:workers'

interface StoredMessage {
  id: string
  userId: string
  text: string
  sentAt: string
}

export class ChatRoom extends DurableObject {
  private sessions = new Map<WebSocket, string>() // ws → userId

  async fetch(request: Request): Promise<Response> {
    const userId = new URL(request.url).searchParams.get('userId')
    if (!userId) return new Response('Missing userId', { status: 400 })

    const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket]
    this.ctx.acceptWebSocket(server)
    this.sessions.set(server, userId)
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, raw: string) {
    const userId = this.sessions.get(ws)
    if (!userId) return

    const msg: StoredMessage = {
      id: crypto.randomUUID(),
      userId,
      text: raw,
      sentAt: new Date().toISOString(),
    }

    // Persist to DO storage
    await this.ctx.storage.put(`msg:${msg.sentAt}:${msg.id}`, msg)

    // Fan out to all connected clients
    const payload = JSON.stringify(msg)
    for (const [session] of this.sessions) {
      try { session.send(payload) } catch { this.sessions.delete(session) }
    }
  }

  async webSocketClose(ws: WebSocket) {
    this.sessions.delete(ws)
  }

  async getHistory(limit = 50): Promise<StoredMessage[]> {
    const entries = await this.ctx.storage.list<StoredMessage>({ prefix: 'msg:', limit, reverse: true })
    return [...entries.values()].reverse()
  }
}
```

## Worker route

```ts
// In index.ts — route WebSocket upgrades to the correct room DO
app.get('/api/chat/:roomId/ws', async (c) => {
  const userId = c.get('userId')
  const roomId = c.req.param('roomId')
  const id = c.env.CHAT_ROOM.idFromName(roomId)
  const room = c.env.CHAT_ROOM.get(id)
  const url = new URL(c.req.url)
  url.searchParams.set('userId', userId)
  return room.fetch(new Request(url, c.req.raw))
})

// Fetch message history
app.get('/api/chat/:roomId/history', async (c) => {
  const id = c.env.CHAT_ROOM.idFromName(c.req.param('roomId'))
  const room = c.env.CHAT_ROOM.get(id)
  const history = await room.getHistory()
  return c.json(history)
})
```

## wrangler.toml additions

```toml
[[durable_objects.bindings]]
name = "CHAT_ROOM"
class_name = "ChatRoom"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["ChatRoom"]
```

Export the class from `index.ts`:
```ts
export { ChatRoom } from './chat/ChatRoom'
```

## React client

```ts
function useChat(roomId: string) {
  const [messages, setMessages] = useState<Message[]>([])
  const ws = useRef<WebSocket | null>(null)

  useEffect(() => {
    const token = await auth.currentUser?.getIdToken()
    const url = `wss://beast-mode-api.<subdomain>.workers.dev/api/chat/${roomId}/ws`
    // Note: WebSocket doesn't support custom headers — pass token as query param
    // The Worker reads it from searchParams and verifies before accepting the WS
    ws.current = new WebSocket(`${url}?token=${token}`)
    ws.current.onmessage = (e) => setMessages(prev => [...prev, JSON.parse(e.data)])
    return () => ws.current?.close()
  }, [roomId])

  const send = (text: string) => ws.current?.send(text)
  return { messages, send }
}
```

> **Auth note**: WebSocket connections can't send `Authorization` headers. Pass the Firebase token as a query param (`?token=...`) and verify it in the DO's `fetch` handler instead of the middleware.

## Done when

- Two browser tabs can open a WebSocket to the same room and exchange messages in real time
- Message history loads on connect
- Unauthenticated connections are rejected

## Next

[Step 5 — Difficulty rating](./05-difficulty-rating.md)
