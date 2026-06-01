import { useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useUser } from '@/hooks/useUser'
import { useGoals } from '@/hooks/useGoals'
import { useCompletions } from '@/hooks/useCompletions'
import DailyChecklist from '@/components/checklist/DailyChecklist'
import JuneCalendar from '@/components/calendar/JuneCalendar'
import GoalCard from '@/components/goals/GoalCard'

type Tab = 'today' | 'calendar' | 'goals'

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
  const location = useLocation()
  const returnTab = (location.state as { from?: string } | null)?.from ?? 'today'
  const { user, loading: userLoading } = useUser(uid)
  const { goals, loading: goalsLoading } = useGoals(uid)
  const { completions, loading: completionsLoading } = useCompletions(uid)
  const [tab, setTab] = useState<Tab>('today')

  const loading = userLoading || goalsLoading || completionsLoading

  const displayName = user?.displayName || user?.email || 'Member'
  const color = uid ? avatarColor(uid) : '#f97316'
  const abbr = initials(displayName)

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => navigate('/', { state: { tab: returnTab } })}
          className="text-gray-400 hover:text-white transition flex items-center gap-1.5 text-sm"
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
          <span className="text-white font-semibold truncate">{displayName}</span>
        </div>

        <span className="ml-auto text-xs text-gray-600 shrink-0">view only</span>
      </header>

      {/* Tab bar */}
      <div className="border-b border-gray-800 px-6">
        <div className="flex gap-1 max-w-2xl mx-auto">
          {(['today', 'calendar', 'goals'] as const).map(t => (
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
            {tab === 'today' && uid && (
              <DailyChecklist
                userId={uid}
                goals={goals}
                completions={completions}
                readOnly
              />
            )}

            {tab === 'calendar' && (
              <JuneCalendar goals={goals} completions={completions} />
            )}

            {tab === 'goals' && (
              <>
                <h2 className="text-xl font-semibold mb-4">Goals</h2>
                {goals.length === 0 ? (
                  <div className="text-center py-16 text-gray-500">
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
          </>
        )}
      </main>
    </div>
  )
}
