import { DurableObject } from 'cloudflare:workers'

interface StoredMessage {
  id: string
  userId: string
  text: string
  sentAt: string
}

type InboundEvent =
  | { type: 'message'; text: string }
  | { type: 'typing' }

export class ChatRoom extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'GET' && url.pathname === '/history') {
      const history = await this.getHistory()
      return Response.json(history)
    }

    if (request.method === 'GET' && url.pathname === '/last-message') {
      const entries = await this.ctx.storage.list<StoredMessage>({ prefix: 'msg:', limit: 1, reverse: true })
      const msg = [...entries.values()][0] ?? null
      return Response.json(msg)
    }

    if (request.method === 'POST' && url.pathname === '/broadcast') {
      const payload = await request.text()
      for (const session of this.ctx.getWebSockets()) {
        try { session.send(payload) } catch { /* disconnected */ }
      }
      return new Response('ok')
    }

    const userId = url.searchParams.get('userId')
    if (!userId) return new Response('Missing userId', { status: 400 })
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 })
    }

    const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket]
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ userId })

    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    const { userId } = ws.deserializeAttachment() as { userId: string }
    const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw)

    let event: InboundEvent
    try { event = JSON.parse(text) } catch { return }

    if (event.type === 'typing') {
      // Fan out to others only — don't store
      const payload = JSON.stringify({ type: 'typing', userId })
      for (const session of this.ctx.getWebSockets()) {
        if (session === ws) continue
        try { session.send(payload) } catch { /* disconnected */ }
      }
      return
    }

    if (event.type === 'message' && event.text?.trim()) {
      const msg: StoredMessage = {
        id: crypto.randomUUID(),
        userId,
        text: event.text.trim(),
        sentAt: new Date().toISOString(),
      }
      await this.ctx.storage.transaction(async (txn) => {
        await txn.put(`msg:${msg.sentAt}:${msg.id}`, msg)
      })

      const payload = JSON.stringify({ type: 'message', ...msg })
      for (const session of this.ctx.getWebSockets()) {
        try { session.send(payload) } catch { /* disconnected */ }
      }
    }
  }

  async webSocketClose(ws: WebSocket) { ws.close() }
  async webSocketError(ws: WebSocket) { ws.close() }

  private async getHistory(limit = 100): Promise<StoredMessage[]> {
    const entries = await this.ctx.storage.list<StoredMessage>({
      prefix: 'msg:',
      limit,
      reverse: true,
    })
    return [...entries.values()].reverse()
  }
}
