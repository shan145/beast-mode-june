import { useState, useEffect } from 'react'
import { subscribeToCompletions } from '@/lib/firestore'
import type { Completion } from '@/types'

export function useCompletions(userId: string | undefined) {
  const [completions, setCompletions] = useState<Completion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    return subscribeToCompletions(userId, c => {
      setCompletions(c)
      setLoading(false)
    })
  }, [userId])

  return { completions, loading }
}
