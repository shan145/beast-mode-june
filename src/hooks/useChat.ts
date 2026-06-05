import { useState, useEffect, useRef, useCallback } from 'react'
import { auth } from '@/lib/firebase'

const WORKER_URL = (import.meta.env.VITE_WORKER_URL as string | undefined)?.replace(/\/$/, '') ?? ''

export interface ChatMessage {
  id: string
  userId: string
  text: string
  sentAt: string
}

type WsEvent =
  | ({ type: 'message' } & ChatMessage)
  | { type: 'typing'; userId: string }

export function useChat(roomId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({})
  const [connected, setConnected] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const sendQueueRef = useRef<string[]>([])
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const clearTyping = useCallback((userId: string) => {
    setTypingUsers(prev => {
      const next = { ...prev }
      delete next[userId]
      return next
    })
  }, [])

  useEffect(() => {
    if (!roomId) return

    // Each effect run gets its own flag. The shared destroyedRef pattern is
    // unsafe: the new effect resets it to false before old async callbacks
    // check it, causing the old connect() to create a WebSocket for the
    // previous room and overwrite wsRef.current.
    let destroyed = false

    let reconnectTimer: ReturnType<typeof setTimeout>

    async function connect() {
      if (destroyed) return
      const token = await auth.currentUser?.getIdToken()
      if (!token || destroyed) return

      const wsUrl = WORKER_URL.replace(/^http/, 'ws')
      const ws = new WebSocket(`${wsUrl}/api/chat/${encodeURIComponent(roomId!)}/ws?token=${token}`)

      // Check again after the sync WS constructor — by now a newer effect may
      // have already claimed wsRef.current for a different room.
      if (destroyed) { ws.close(); return }
      wsRef.current = ws

      ws.onopen = () => {
        if (!destroyed) {
          setConnected(true)
          const queued = sendQueueRef.current.splice(0)
          for (const payload of queued) {
            try { ws.send(payload) } catch { /* ignore */ }
          }
        }
      }

      ws.onmessage = (e) => {
        if (destroyed) return
        let event: WsEvent
        try { event = JSON.parse(e.data) } catch { return }

        if (event.type === 'message') {
          const { type: _, ...msg } = event
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev
            return [...prev, msg]
          })
        } else if (event.type === 'typing') {
          const { userId } = event
          setTypingUsers(prev => ({ ...prev, [userId]: true }))
          clearTimeout(typingTimers.current[userId])
          typingTimers.current[userId] = setTimeout(() => clearTyping(userId), 3000)
        }
      }

      ws.onclose = () => {
        if (destroyed) return
        setConnected(false)
        reconnectTimer = setTimeout(connect, 3000)
      }

      ws.onerror = () => ws.close()
    }

    async function init() {
      try {
        const token = await auth.currentUser?.getIdToken()
        if (token && !destroyed) {
          const res = await fetch(`${WORKER_URL}/api/chat/${encodeURIComponent(roomId!)}/history`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (res.ok) {
            const history: ChatMessage[] = await res.json()
            if (!destroyed) setMessages(history)
          }
        }
      } catch { /* ignore — connect anyway */ }
      connect()
    }

    setMessages([])
    setTypingUsers({})
    init()

    return () => {
      destroyed = true
      clearTimeout(reconnectTimer)
      Object.values(typingTimers.current).forEach(clearTimeout)
      sendQueueRef.current = []
      wsRef.current?.close()
      wsRef.current = null
      setConnected(false)
    }
  }, [roomId, clearTyping])

  const send = useCallback((text: string) => {
    const payload = JSON.stringify({ type: 'message', text })
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(payload)
    } else {
      sendQueueRef.current.push(payload)
    }
  }, [])

  const sendTyping = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'typing' }))
    }
  }, [])

  return { messages, typingUsers, connected, send, sendTyping }
}
