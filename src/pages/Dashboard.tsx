import { useState } from 'react'
import { signOut } from 'firebase/auth'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth, clearGroupAuthed } from '@/hooks/useAuth'
import { useGoals } from '@/hooks/useGoals'
import { useCompletions } from '@/hooks/useCompletions'
import { useUsers } from '@/hooks/useUsers'
import { deleteGoal } from '@/lib/firestore'
import { auth } from '@/lib/firebase'
import { isMobile } from '@/pages/Login'

import GoalCard from '@/components/goals/GoalCard'
import GoalForm from '@/components/goals/GoalForm'
import DailyChecklist from '@/components/checklist/DailyChecklist'
import JuneCalendar from '@/components/calendar/JuneCalendar'
import MemberCard from '@/components/community/MemberCard'
import type { Goal } from '@/types'

type Tab = 'today' | 'calendar' | 'community' | 'goals'

export default function Dashboard() {
  const { firebaseUser } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { goals, loading: goalsLoading } = useGoals(firebaseUser?.uid)
  const { completions, loading: completionsLoading } = useCompletions(firebaseUser?.uid)
  const { users } = useUsers()

  const otherMembers = users
    .filter(u => u.uid !== firebaseUser?.uid)
    .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''))

  const [tab, setTab] = useState<Tab>(
    (location.state as { tab?: Tab } | null)?.tab ?? 'today'
  )
  const [showForm, setShowForm] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [deletingGoal, setDeletingGoal] = useState<Goal | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleSignOut() {
    clearGroupAuthed()
    if (!isMobile) await signOut(auth)
    window.location.href = '/login'
  }

  async function confirmDelete() {
    if (!deletingGoal) return
    setDeleting(true)
    await deleteGoal(deletingGoal.id)
    setDeleting(false)
    setDeletingGoal(null)
  }

  const loading = goalsLoading || completionsLoading

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-orange-500">Beast Mode June</h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm hidden sm:block">
            {firebaseUser?.displayName}
          </span>
          <button
            onClick={handleSignOut}
            className="text-gray-400 hover:text-white text-sm transition"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Tab bar */}
      <div className="border-b border-gray-800 px-6">
        <div className="flex gap-1 max-w-2xl mx-auto">
          {(['today', 'calendar', 'community', 'goals'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                tab === t
                  ? 'border-orange-500 text-orange-500'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {loading ? (
          <p className="text-gray-500 text-sm">Loading...</p>
        ) : (
          <>
            {tab === 'today' && firebaseUser && (
              <DailyChecklist
                userId={firebaseUser.uid}
                goals={goals}
                completions={completions}
              />
            )}

            {tab === 'calendar' && (
              <JuneCalendar goals={goals} completions={completions} />
            )}

            {tab === 'community' && (
              <>
                <h2 className="text-xl font-semibold mb-4">The Group</h2>
                {otherMembers.length === 0 ? (
                  <div className="text-center py-16 text-gray-500">
                    <p className="text-sm">No other members yet — share the group password to invite friends.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {otherMembers.map(member => (
                      <MemberCard
                        key={member.uid}
                        member={member}
                        onClick={() => navigate(`/member/${member.uid}`, { state: { from: 'community' } })}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

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
                  <div className="text-center py-16 text-gray-500">
                    <p className="text-lg mb-1">No goals yet</p>
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
          </>
        )}
      </main>

      {(showForm || editingGoal) && firebaseUser && (
        <GoalForm
          userId={firebaseUser.uid}
          goal={editingGoal ?? undefined}
          onClose={() => {
            setShowForm(false)
            setEditingGoal(null)
          }}
        />
      )}

      {deletingGoal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-semibold text-white mb-2">Delete goal?</h2>
            <p className="text-gray-400 text-sm mb-1">
              <span className="text-white font-medium">"{deletingGoal.title}"</span> will be removed.
            </p>
            <p className="text-red-400 text-sm mb-6">
              All saved progress on this goal will be lost.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingGoal(null)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg py-2.5 text-sm transition"
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
