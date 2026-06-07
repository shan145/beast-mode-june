import { useState, useEffect } from 'react'
import { subscribeToKudosSent } from '@/lib/firestore'
import { todayET } from '@/lib/time'
import type { Kudos } from '@/types'

// Kudos the given user has already sent today, keyed by `${toUserId}:${type}` for quick lookup —
// drives the persistent "Sent!" state on Send Beast Kudos / Send Celebration buttons.
export function useKudosSentToday(fromUserId: string | undefined) {
  const [sent, setSent] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!fromUserId) { setSent(new Set()); return }
    return subscribeToKudosSent(fromUserId, todayET(), (kudos: Kudos[]) => {
      setSent(new Set(kudos.map(k => `${k.toUserId}:${k.type}`)))
    })
  }, [fromUserId])

  function hasSent(toUserId: string, type: Kudos['type']): boolean {
    return sent.has(`${toUserId}:${type}`)
  }

  return { hasSent }
}
