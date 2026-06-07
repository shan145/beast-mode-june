import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useGoals } from '@/hooks/useGoals'
import { useCompletions } from '@/hooks/useCompletions'
import { useUsers } from '@/hooks/useUsers'
import { useAllGoals } from '@/hooks/useAllGoals'
import { useAllCompletions } from '@/hooks/useAllCompletions'
import { usePosts } from '@/hooks/usePosts'
import { useUser } from '@/hooks/useUser'
import { deleteGoal } from '@/lib/firestore'
import { useTheme } from '@/contexts/ThemeContext'

import { todayET } from '@/lib/time'
import { registerPushSubscription, sendNotification } from '@/lib/pushNotifications'
import GoalCard from '@/components/goals/GoalCard'
import GoalForm from '@/components/goals/GoalForm'
import DailyChecklist from '@/components/checklist/DailyChecklist'
import JuneCalendar from '@/components/calendar/JuneCalendar'
import MemberCard from '@/components/community/MemberCard'
import Leaderboard from '@/components/community/Leaderboard'
import Feed from '@/components/feed/Feed'
import ChatView from '@/components/chat/ChatView'
import NavTabs, { type TabDef } from '@/components/ui/NavTabs'
import CelebrationGift from '@/components/ui/CelebrationGift'
import CelebrationFireworks from '@/components/ui/CelebrationFireworks'
import type { Goal } from '@/types'

type Tab = 'today' | 'calendar' | 'community' | 'feed' | 'chat' | 'goals'

const BASE_TABS: Omit<TabDef<Tab>, 'badge'>[] = [
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
    id: 'feed',
    label: 'Feed',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 21V9" />
      </svg>
    ),
  },
  {
    id: 'community',
    label: 'Group',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
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

const ChatIcon = (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
)

export default function Dashboard() {
  const { firebaseUser } = useAuth()
  const [chatUnread, setChatUnread] = useState(0)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { theme, toggle: toggleTheme } = useTheme()
  const { goals, loading: goalsLoading } = useGoals(firebaseUser?.uid)
  const { completions, loading: completionsLoading } = useCompletions(firebaseUser?.uid)
  const { users } = useUsers()
  const { goals: allGoals } = useAllGoals()
  const { completions: allCompletions } = useAllCompletions()
  const { posts: allPosts } = usePosts()
  const { user: ownProfile } = useUser(firebaseUser?.uid)

  const sortedMembers = [...users].sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''))

  // Compute which members have completed all daily goals today (for kudos button)
  const allDailyDoneTodayByUser = useMemo(() => {
    const today = todayET()
    const result: Record<string, boolean> = {}
    for (const user of users) {
      const dailyGoals = allGoals.filter(g => g.userId === user.uid && g.frequency.type === 'daily')
      if (dailyGoals.length === 0) { result[user.uid] = false; continue }
      result[user.uid] = dailyGoals.every(g =>
        allCompletions.some(c => c.goalId === g.id && c.date === today)
      )
    }
    return result
  }, [users, allGoals, allCompletions])

  // Compute which members have any completion today (for celebration button)
  const anyCompletionTodayByUser = useMemo(() => {
    const today = todayET()
    const result: Record<string, boolean> = {}
    for (const user of users) {
      result[user.uid] = allCompletions.some(c => c.userId === user.uid && c.date === today)
    }
    return result
  }, [users, allCompletions])

  const tab = (searchParams.get('tab') as Tab) ?? (localStorage.getItem('beast_mode_tab') as Tab) ?? 'today'
  const celebrationName = searchParams.get('celebration')
  const fireworksName = searchParams.get('fireworks')

  function selectTab(t: Tab) {
    localStorage.setItem('beast_mode_tab', t)
    setSearchParams({ tab: t })
  }

  function dismissCelebration() {
    setSearchParams(p => { p.delete('celebration'); return p }, { replace: true })
  }

  function dismissFireworks() {
    setSearchParams(p => { p.delete('fireworks'); return p }, { replace: true })
  }

  // Register push subscription once on mount — silently skips if permission denied
  useEffect(() => {
    registerPushSubscription()
  }, [])

  const [testNotifState, setTestNotifState] = useState<'idle' | 'sending' | 'ok' | 'err'>('idle')

  async function sendTestNotification() {
    setTestNotifState('sending')
    const subscribed = await registerPushSubscription()
    if (!subscribed) { setTestNotifState('err'); setTimeout(() => setTestNotifState('idle'), 3000); return }
    await sendNotification('feed-post', { userName: 'Test (you)' }, { recipientIds: firebaseUser ? [firebaseUser.uid] : [] })
    setTestNotifState('ok')
    setTimeout(() => setTestNotifState('idle'), 3000)
  }

  const [showForm, setShowForm] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [deletingGoal, setDeletingGoal] = useState<Goal | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function confirmDelete() {
    if (!deletingGoal) return
    setDeleting(true)
    await deleteGoal(deletingGoal.id)
    setDeleting(false)
    setDeletingGoal(null)
  }

  const loading = goalsLoading || completionsLoading

  return (
    <div className={`bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white ${tab === 'chat' ? 'h-dvh overflow-hidden flex flex-col' : 'min-h-screen'}`}>
      {celebrationName && <CelebrationGift fromName={celebrationName} onDismiss={dismissCelebration} />}
      {fireworksName && <CelebrationFireworks fromName={fireworksName} onDismiss={dismissFireworks} />}
      <header className={`border-b border-gray-200 dark:border-gray-800 px-6 pb-4 flex items-center justify-between${tab === 'chat' ? ' flex-shrink-0' : ''}`} style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}>
        <h1 className="text-lg font-bold text-orange-500">Beast Mode June</h1>
        <div className="flex items-center gap-3">
          <span className="text-gray-500 dark:text-gray-400 text-sm hidden sm:block truncate max-w-[140px]">
            {ownProfile?.displayName || firebaseUser?.displayName}
          </span>
          {import.meta.env.DEV && (
            <button
              onClick={sendTestNotification}
              disabled={testNotifState === 'sending'}
              title="Send test push notification to yourself"
              className={`p-1.5 rounded-lg text-xs font-medium transition ${
                testNotifState === 'ok' ? 'text-green-500' :
                testNotifState === 'err' ? 'text-red-500' :
                'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              {testNotifState === 'sending' ? '...' : testNotifState === 'ok' ? '✓ sent' : testNotifState === 'err' ? '✗ failed' : '🔔'}
            </button>
          )}
          <button
            onClick={() => selectTab('chat')}
            className={`relative p-1.5 rounded-lg transition ${
              tab === 'chat'
                ? 'text-orange-500'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            aria-label="Chat"
          >
            {ChatIcon}
            {tab !== 'chat' && chatUnread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-orange-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                {chatUnread > 99 ? '99+' : chatUnread}
              </span>
            )}
          </button>
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          <button
            onClick={() => navigate('/settings')}
            className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            aria-label="Settings"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </header>

      <div className={tab === 'chat' ? 'flex-shrink-0' : ''}>
        <NavTabs
          tabs={BASE_TABS}
          active={tab}
          onChange={selectTab}
        />
      </div>

      <main className={tab === 'chat'
        ? 'flex-1 min-h-0 max-w-2xl w-full mx-auto px-4 pt-2 pb-28 md:pb-0 overflow-hidden'
        : 'max-w-2xl mx-auto px-6 pb-28 md:pb-8 pt-8'
      }>
        {/* Always-mounted chat so WS + unread state stays alive on other tabs */}
        {firebaseUser && (
          <div className={tab === 'chat' ? 'h-full' : 'hidden'}>
            <ChatView
              currentUserId={firebaseUser.uid}
              users={users}
              onUnreadChange={setChatUnread}
              active={tab === 'chat'}
            />
          </div>
        )}

        {tab !== 'chat' && (
          loading ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3].map(i => <div key={i} className="h-14 bg-gray-200 dark:bg-gray-800 rounded-xl" />)}
            </div>
          ) : (
            <div key={tab} className="tab-fade-in">
              {tab === 'today' && firebaseUser && (
                <DailyChecklist
                  userId={firebaseUser.uid}
                  goals={goals}
                  completions={completions}
                />
              )}

              {tab === 'calendar' && (
                <JuneCalendar goals={goals} completions={completions} userId={firebaseUser?.uid} />
              )}

              {tab === 'community' && (
                <>
                  <h2 className="text-xl font-semibold mb-4">The Group</h2>

                  {/* Leaderboard */}
                  {users.length > 1 && (
                    <Leaderboard
                      users={users}
                      allGoals={allGoals}
                      allCompletions={allCompletions}
                      allPosts={allPosts}
                      currentUserId={firebaseUser?.uid}
                      onMemberClick={uid => navigate(`/member/${uid}`)}
                    />
                  )}

                  {/* Members list */}
                  {sortedMembers.length === 0 ? (
                    <div className="text-center py-16 text-gray-400 dark:text-gray-500">
                      <p className="text-sm">No members yet — share the group password to invite friends.</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">Members</p>
                      <div className="space-y-2">
                        {sortedMembers.map(member => (
                          <MemberCard
                            key={member.uid}
                            member={member}
                            isYou={member.uid === firebaseUser?.uid}
                            allDailyDoneToday={allDailyDoneTodayByUser[member.uid]}
                            anyCompletionToday={anyCompletionTodayByUser[member.uid]}
                            currentUserName={ownProfile?.displayName}
                            onClick={() => navigate(`/member/${member.uid}`)}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}

              {tab === 'feed' && <Feed />}

              {tab === 'goals' && (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold">Your Goals</h2>
                    <button
                      onClick={() => setShowForm(true)}
                      className="bg-orange-500 hover:bg-orange-400 text-white font-semibold rounded-lg px-4 py-2 text-sm transition"
                    >
                      + Add goal
                    </button>
                  </div>

                  {goals.length === 0 ? (
                    <div className="text-center py-16 text-gray-400 dark:text-gray-500">
                      <p className="text-lg mb-1 text-gray-500 dark:text-gray-400">No goals yet</p>
                      <p className="text-sm">Add your first goal to get started.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {goals.map(goal => (
                        <GoalCard
                          key={goal.id}
                          goal={goal}
                          onEdit={() => setEditingGoal(goal)}
                          onDelete={() => setDeletingGoal(goal)}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        )}
      </main>

      {(showForm || editingGoal) && firebaseUser && (
        <GoalForm
          userId={firebaseUser.uid}
          goal={editingGoal ?? undefined}
          onClose={() => { setShowForm(false); setEditingGoal(null) }}
        />
      )}

      {deletingGoal && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-sm shadow-xl border border-gray-100 dark:border-transparent">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete goal?</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-1">
              <span className="text-gray-900 dark:text-white font-medium">"{deletingGoal.title}"</span> will be removed.
            </p>
            <p className="text-red-500 dark:text-red-400 text-sm mb-6">All saved progress on this goal will be lost.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingGoal(null)}
                className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg py-2.5 text-sm transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg py-2.5 text-sm transition disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
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
