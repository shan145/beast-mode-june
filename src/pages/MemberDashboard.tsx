import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useUser } from '@/hooks/useUser'
import { useGoals } from '@/hooks/useGoals'
import { useCompletions } from '@/hooks/useCompletions'
import { useTheme } from '@/contexts/ThemeContext'
import { sendNotification } from '@/lib/pushNotifications'
import { auth } from '@/lib/firebase'
import { todayET } from '@/lib/time'
import DailyChecklist from '@/components/checklist/DailyChecklist'
import JuneCalendar from '@/components/calendar/JuneCalendar'
import GoalCard from '@/components/goals/GoalCard'
import NavTabs, { type TabDef } from '@/components/ui/NavTabs'

type Tab = 'today' | 'calendar' | 'goals'

const TABS: TabDef<Tab>[] = [
  {
    id: 'today',
    label: 'Today',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
        <path d="M13 3H11a2 2 0 00-2 2v0a2 2 0 002 2h2a2 2 0 002-2v0a2 2 0 00-2-2z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
  {
    id: 'calendar',
    label: 'Calendar',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
  },
  {
    id: 'goals',
    label: 'Goals',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    ),
  },
]

const AVATAR_COLORS = [
  '#f97316', '#3b82f6', '#a855f7', '#10b981', '#ef4444', '#f59e0b', '#06b6d4',
]

function avatarColor(uid: string): string {
  const hash = uid.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function initials(name: string): string {
  return name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function MemberDashboard() {
  const { uid } = useParams<{ uid: string }>()
  const navigate = useNavigate()
  const { firebaseUser } = useAuth()

  const { theme, toggle: toggleTheme } = useTheme()
  const { user, loading: userLoading } = useUser(uid)
  const { user: ownProfile } = useUser(firebaseUser?.uid)
  const { goals, loading: goalsLoading } = useGoals(uid)
  const { completions, loading: completionsLoading } = useCompletions(uid)
  const [tab, setTab] = useState<Tab>('today')
  const [beastSent, setBeastSent] = useState(false)
  const [celebSent, setCelebSent] = useState(false)

  const loading = userLoading || goalsLoading || completionsLoading
  const isCurrentUser = firebaseUser?.uid === uid

  const allDailyDone = useMemo(() => {
    const today = todayET()
    const dailyGoals = goals.filter(g => g.frequency.type === 'daily')
    if (dailyGoals.length === 0) return false
    return dailyGoals.every(g => completions.some(c => c.goalId === g.id && c.date === today))
  }, [goals, completions])

  const anyCompletionToday = useMemo(() => {
    const today = todayET()
    return completions.some(c => c.date === today)
  }, [completions])

  async function handleBeast() {
    const currentUser = auth.currentUser
    if (!currentUser || !uid) return
    setBeastSent(true)
    const fromName = ownProfile?.displayName ?? currentUser.displayName ?? 'Someone'
    const toName = user?.displayName || user?.email || 'Someone'
    sendNotification('gift-sent', { userName: fromName, toName, toUserId: uid }, { recipientIds: [uid] })
    setTimeout(() => setBeastSent(false), 1500)
  }

  async function handleCelebration() {
    const currentUser = auth.currentUser
    if (!currentUser || !uid) return
    setCelebSent(true)
    const fromName = ownProfile?.displayName ?? currentUser.displayName ?? 'Someone'
    const toName = user?.displayName || user?.email || 'Someone'
    sendNotification('celebration-sent', { userName: fromName, toName, toUserId: uid }, { recipientIds: [uid] })
    setTimeout(() => setCelebSent(false), 1500)
  }

  const displayName = user?.displayName || user?.email || 'Member'
  const color = uid ? avatarColor(uid) : '#f97316'
  const abbr = initials(displayName)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white">
      <header className="border-b border-gray-200 dark:border-gray-800 px-6 pb-4 flex items-center gap-3" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}>
        <button
          onClick={() => navigate(-1)}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition flex items-center gap-1.5 text-sm shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ backgroundColor: color }}
          >
            {abbr}
          </div>
          <span className="text-gray-900 dark:text-white font-semibold truncate">{displayName}</span>
        </div>

        <div className="ml-auto flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-400 dark:text-gray-600">view only</span>
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </header>

      <NavTabs tabs={TABS} active={tab} onChange={setTab} />

      <main className="max-w-2xl mx-auto px-6 pt-8 pb-28 md:pb-8">
        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map(i => <div key={i} className="h-14 bg-gray-200 dark:bg-gray-800 rounded-xl" />)}
          </div>
        ) : (
          <div key={tab} className="tab-fade-in">
            {tab === 'today' && uid && (
              <>
                {!isCurrentUser && allDailyDone && (
                  <div className="mb-6 rounded-2xl bg-orange-500 px-5 py-4 flex flex-col sm:flex-row sm:items-center items-center gap-3">
                    <div className="flex-1 min-w-0 text-center sm:text-left">
                      <p className="text-white font-bold">🔥 All tasks done today!</p>
                      <p className="text-orange-100 text-sm mt-0.5">{displayName} is in beast mode</p>
                    </div>
                    <button
                      onClick={handleBeast}
                      disabled={beastSent}
                      className={`shrink-0 text-sm font-bold px-4 py-2.5 rounded-xl transition
                        ${beastSent
                          ? 'bg-white/20 text-white/60 cursor-default'
                          : 'bg-white text-orange-500 hover:bg-orange-50 active:bg-orange-100 shadow-sm'
                        }`}
                    >
                      {beastSent ? 'Sent! 🎉' : 'Send Beast Kudos'}
                    </button>
                  </div>
                )}
                {!isCurrentUser && !allDailyDone && anyCompletionToday && (
                  <div className="mb-6 rounded-2xl bg-sky-500 px-5 py-4 flex flex-col sm:flex-row sm:items-center items-center gap-3">
                    <div className="flex-1 min-w-0 text-center sm:text-left">
                      <p className="text-white font-bold">🎆 Making progress today!</p>
                      <p className="text-sky-100 text-sm mt-0.5">{displayName} is putting in the work</p>
                    </div>
                    <button
                      onClick={handleCelebration}
                      disabled={celebSent}
                      className={`shrink-0 text-sm font-bold px-4 py-2.5 rounded-xl transition
                        ${celebSent
                          ? 'bg-white/20 text-white/60 cursor-default'
                          : 'bg-white text-sky-500 hover:bg-sky-50 active:bg-sky-100 shadow-sm'
                        }`}
                    >
                      {celebSent ? 'Sent! 🎉' : 'Send Celebration'}
                    </button>
                  </div>
                )}
                <DailyChecklist
                  userId={uid}
                  goals={goals}
                  completions={completions}
                  readOnly
                />
              </>
            )}

            {tab === 'calendar' && (
              <JuneCalendar goals={goals} completions={completions} userId={uid} readOnly />
            )}

            {tab === 'goals' && (
              <>
                <h2 className="text-xl font-semibold mb-4">Goals</h2>
                {goals.length === 0 ? (
                  <div className="text-center py-16 text-gray-400 dark:text-gray-500">
                    <p className="text-sm">No goals added yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {goals.map(goal => (
                      <GoalCard key={goal.id} goal={goal} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

function SunIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}
