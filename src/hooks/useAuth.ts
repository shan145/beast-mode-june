import { useState, useEffect } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth } from '@/lib/firebase'

const GROUP_PASSWORD_KEY = 'beast_mode_authed'
export const GROUP_PASSWORD = import.meta.env.VITE_GROUP_PASSWORD as string

export interface AuthState {
  firebaseUser: User | null
  isGroupAuthed: boolean
  loading: boolean
}

export function useAuth(): AuthState {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(auth, user => {
      setFirebaseUser(user)
      setLoading(false)
    })
  }, [])

  const isGroupAuthed = localStorage.getItem(GROUP_PASSWORD_KEY) === 'true'

  return { firebaseUser, isGroupAuthed, loading }
}

export function setGroupAuthed() {
  localStorage.setItem(GROUP_PASSWORD_KEY, 'true')
}

export function clearGroupAuthed() {
  localStorage.removeItem(GROUP_PASSWORD_KEY)
}
