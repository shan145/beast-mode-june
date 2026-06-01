import { useState } from 'react'
import { signInWithPopup, signOut } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { auth, googleProvider } from '@/lib/firebase'
import { GROUP_PASSWORD, setGroupAuthed } from '@/hooks/useAuth'
import { upsertUser } from '@/lib/firestore'

export default function Login() {
  const [step, setStep] = useState<'google' | 'password'>('google')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleGoogleSignIn() {
    setLoading(true)
    setError('')
    try {
      const result = await signInWithPopup(auth, googleProvider)
      await upsertUser({
        uid: result.user.uid,
        email: result.user.email ?? '',
        displayName: result.user.displayName ?? '',
        photoURL: result.user.photoURL ?? '',
      })
      setStep('password')
    } catch {
      setError('Sign-in failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password === GROUP_PASSWORD) {
      setGroupAuthed()
      navigate('/')
    } else {
      setError('Wrong password. Ask the group for access.')
      await signOut(auth)
      setStep('google')
      setPassword('')
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="bg-gray-900 rounded-2xl p-8 w-full max-w-sm shadow-xl">
        <h1 className="text-2xl font-bold text-white mb-1">Beast Mode June</h1>
        <p className="text-gray-400 text-sm mb-8">Track goals. Stay accountable.</p>

        {step === 'google' && (
          <>
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-white text-gray-900 font-medium rounded-lg px-4 py-3 hover:bg-gray-100 transition disabled:opacity-50"
            >
              <GoogleIcon />
              {loading ? 'Signing in...' : 'Sign in with Google'}
            </button>
            {error && <p className="mt-3 text-red-400 text-sm">{error}</p>}
          </>
        )}

        {step === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-gray-300 text-sm mb-1">Group password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter group password"
                autoFocus
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              className="w-full bg-orange-500 hover:bg-orange-400 text-white font-semibold rounded-lg px-4 py-3 transition"
            >
              Enter
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}
