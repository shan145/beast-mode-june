import { useState, useEffect } from 'react'
import { subscribeToAllGoals } from '@/lib/firestore'
import type { Goal } from '@/types'

export function useAllGoals() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return subscribeToAllGoals(g => { setGoals(g); setLoading(false) })
  }, [])

  return { goals, loading }
}
