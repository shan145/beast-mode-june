import { useState } from 'react'
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

import GoalCard from '@/components/goals/GoalCard'
import GoalForm from '@/components/goals/GoalForm'
import DailyChecklist from '@/components/checklist/DailyChecklist'
import JuneCalendar from '@/components/calendar/JuneCalendar'
import MemberCard from '@/components/community/MemberCard'
import Leaderboard from '@/components/community/Leaderboard'
import Feed from '@/components/feed/Feed'
import NavTabs, { type TabDef } from '@/components/ui/NavTabs'
import type { Goal } from '@/types'

type Tab = 'today' | 'calendar' | 'community' | 'feed' | 'goals'

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

export default function Dashboard() {
  const { firebaseUser } = useAuth()
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

  const tab = (searchParams.get('tab') as Tab) ?? 'feed'

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white">
      <header className="border-b border-gray-200 dark:border-gray-800 px-6 pb-4 flex items-center justify-between" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}>
        <h1 className="text-lg font-bold text-orange-500">Beast Mode June</h1>
        <div className="flex items-center gap-3">
          <span className="text-gray-500 dark:text-gray-400 text-sm hidden sm:block truncate max-w-[140px]">
            {ownProfile?.displayName || firebaseUser?.displayName}
          </span>
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

      <NavTabs tabs={TABS} active={tab} onChange={t => setSearchParams({ tab: t })} />

      <main className="max-w-2xl mx-auto px-6 pt-8 pb-28 md:pb-8">
        {loading ? (
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
