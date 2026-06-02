import { useState, useEffect } from 'react'
import { subscribeToAllCompletions } from '@/lib/firestore'
import type { Completion } from '@/types'

export function useAllCompletions() {
  const [completions, setCompletions] = useState<Completion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return subscribeToAllCompletions(c => { setCompletions(c); setLoading(false) })
  }, [])

  return { completions, loading }
}
