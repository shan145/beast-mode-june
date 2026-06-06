import { useState, useEffect } from 'react'
import { signOut } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { useAuth, clearGroupAuthed } from '@/hooks/useAuth'
import { useUser } from '@/hooks/useUser'
import { updateUserDisplayName } from '@/lib/firestore'
import { auth } from '@/lib/firebase'
import { useTheme } from '@/contexts/ThemeContext'
import { registerPushSubscription } from '@/lib/pushNotifications'

function SunIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <circle cx="12" cy="12" r="5" />
      <path strokeLinecap="round" d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  )
}

type NotifStatus = 'loading' | 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed'

export default function Settings() {
  const { firebaseUser } = useAuth()
  const { user: ownProfile } = useUser(firebaseUser?.uid)
  const { theme, toggle: toggleTheme } = useTheme()
  const navigate = useNavigate()

  const currentName = ownProfile?.displayName ?? firebaseUser?.displayName ?? ''
  const [nameInput, setNameInput] = useState(currentName)
  const [nameSaving, setNameSaving] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)

  const [notifStatus, setNotifStatus] = useState<NotifStatus>('loading')
  const [notifBusy, setNotifBusy] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setNotifStatus('unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setNotifStatus('denied')
      return
    }
    navigator.serviceWorker.getRegistration('/sw.js')
      .then(reg => reg ? reg.pushManager.getSubscription() : null)
      .then(sub => setNotifStatus(sub ? 'subscribed' : 'unsubscribed'))
      .catch(() => setNotifStatus('unsubscribed'))
  }, [])

  async function enableNotifications() {
    setNotifBusy(true)
    const ok = await registerPushSubscription()
    if (ok) {
      setNotifStatus('subscribed')
    } else if (Notification.permission === 'denied') {
      setNotifStatus('denied')
    }
    setNotifBusy(false)
  }

  // Populate input once the Firestore profile loads
  useEffect(() => {
    if (ownProfile?.displayName) setNameInput(ownProfile.displayName)
  }, [ownProfile?.displayName])

  async function saveName() {
    const trimmed = nameInput.trim()
    if (!trimmed || trimmed === ownProfile?.displayName || !firebaseUser) return
    setNameSaving(true)
    await updateUserDisplayName(firebaseUser.uid, trimmed)
    setNameSaving(false)
    setNameSaved(true)
    setTimeout(() => setNameSaved(false), 2000)
  }

  async function handleSignOut() {
    clearGroupAuthed()
    await signOut(auth)
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white">
      <header className="border-b border-gray-200 dark:border-gray-800 px-6 pb-4 flex items-center gap-4" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}>
        <button
          onClick={() => navigate('/')}
          className="p-1.5 -ml-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          aria-label="Back"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold">Settings</h1>
      </header>

      <main className="max-w-lg mx-auto px-6 pt-8 pb-16 space-y-8">

        {/* Profile */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">Profile</h2>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
            <div className="px-4 py-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Display name
              </label>
              <div className="flex gap-2">
                <input
                  value={nameInput}
                  onChange={e => { setNameInput(e.target.value); setNameSaved(false) }}
                  onKeyDown={e => e.key === 'Enter' && saveName()}
                  placeholder="Your name"
                  maxLength={40}
                  className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <button
                  onClick={saveName}
                  disabled={nameSaving || !nameInput.trim() || nameInput.trim() === ownProfile?.displayName}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white font-semibold rounded-lg text-sm transition"
                >
                  {nameSaving ? 'Saving…' : nameSaved ? 'Saved!' : 'Save'}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                Shown to all members of the group.
              </p>
            </div>

            <div className="px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Google account</span>
              <span className="text-sm text-gray-900 dark:text-white truncate ml-4 max-w-[200px]">{firebaseUser?.email}</span>
            </div>
          </div>
        </section>

        {/* Appearance */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">Appearance</h2>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
            <button
              onClick={toggleTheme}
              className="w-full px-4 py-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition rounded-2xl"
            >
              <span className="text-sm font-medium text-gray-900 dark:text-white">Theme</span>
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <span className="text-sm">{theme === 'dark' ? 'Dark' : 'Light'}</span>
                {theme === 'dark' ? <MoonIcon /> : <SunIcon />}
              </div>
            </button>
          </div>
        </section>

        {/* Notifications */}
        {notifStatus !== 'unsupported' && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">Notifications</h2>
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
              <div className="px-4 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Push notifications</p>
                  {notifStatus === 'denied' && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Blocked — enable in iOS Settings &gt; Safari</p>
                  )}
                  {notifStatus === 'subscribed' && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">You'll be notified of group activity</p>
                  )}
                </div>
                {notifStatus === 'subscribed' && (
                  <span className="flex items-center gap-1.5 text-sm text-green-500 font-medium">
                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                    On
                  </span>
                )}
                {(notifStatus === 'unsubscribed' || notifStatus === 'loading') && (
                  <button
                    onClick={enableNotifications}
                    disabled={notifBusy || notifStatus === 'loading'}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white font-semibold rounded-lg text-sm transition"
                  >
                    {notifBusy ? 'Enabling…' : 'Enable'}
                  </button>
                )}
                {notifStatus === 'denied' && (
                  <span className="text-sm text-gray-400 dark:text-gray-500">Blocked</span>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Account */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">Account</h2>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
            <button
              onClick={handleSignOut}
              className="w-full px-4 py-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition rounded-2xl"
            >
              <span className="text-sm font-medium text-red-500">Sign out</span>
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </section>

      </main>
    </div>
  )
}
