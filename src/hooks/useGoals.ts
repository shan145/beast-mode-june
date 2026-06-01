import { useState, useEffect } from 'react'
import { subscribeToGoals } from '@/lib/firestore'
import type { Goal } from '@/types'

export function useGoals(userId: string | undefined) {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }
    const unsub = subscribeToGoals(userId, g => {
      setGoals(g)
      setLoading(false)
    })
    return unsub
  }, [userId])

  return { goals, loading }
}
