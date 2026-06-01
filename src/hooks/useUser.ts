import { useState, useEffect } from 'react'
import { subscribeToUser } from '@/lib/firestore'
import type { UserProfile } from '@/types'

export function useUser(uid: string | undefined) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) { setLoading(false); return }
    return subscribeToUser(uid, u => { setUser(u); setLoading(false) })
  }, [uid])

  return { user, loading }
}
