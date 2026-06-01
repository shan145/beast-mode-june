import { useState, useEffect } from 'react'
import { subscribeToUsers } from '@/lib/firestore'
import type { UserProfile } from '@/types'

export function useUsers() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return subscribeToUsers(u => { setUsers(u); setLoading(false) })
  }, [])

  return { users, loading }
}
