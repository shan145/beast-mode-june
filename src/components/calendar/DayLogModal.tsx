import { useState } from 'react'
import { addCompletion, removeCompletion } from '@/lib/firestore'
import { weekStart, weekEnd } from '@/lib/time'
import type { Goal, Completion } from '@/types'

interface Props {
  date: string
  userId?: string
  goals: Goal[]
  completions: Completion[]
  onClose: () => void
  readOnly?: boolean
}

export default function DayLogModal({ date, userId, goals, completions, onClose, readOnly }: Props) {
  // Local copy for optimistic UI — stays snappy without waiting for Firestore round-trip
  const [local, setLocal] = useState<Completion[]>(completions)

  const ws = weekStart(date)
  const we = weekEnd(date)

  const dailyGoals = goals.filter(g => g.frequency.type === 'daily')
  const weeklyGoals = goals.filter(g => g.frequency.type === 'weekly')

  const label = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })

  function isDone(goalId: string) {
    return local.some(c => c.goalId === goalId && c.date === date)
  }

  function weekCount(goalId: string) {
    return local.filter(c => c.goalId === goalId && c.date >= ws && c.date <= we).length
  }

  async function handleToggle(goalId: string) {
    if (readOnly || !userId) return
    if (isDone(goalId)) {
      setLocal(prev => prev.filter(c => !(c.goalId === goalId && c.date === date)))
      await removeCompletion(userId, goalId, date)
    } else {
      setLocal(prev => [
        ...prev,
        { id: '_local', goalId, userId, date, completedAt: null as any },
      ])
      await addCompletion(userId, goalId, date)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4 sm:p-6">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">{label}</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {readOnly ? 'View only' : 'Tap goals to log or remove completions'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition p-1 -mt-0.5 -mr-1"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Goal list */}
        <div className="px-5 py-4 space-y-5 max-h-[55vh] overflow-y-auto">
          {goals.length === 0 && (
            <p className="text-center text-gray-400 dark:text-gray-500 text-sm py-4">No goals to log.</p>
          )}

          {dailyGoals.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
                Daily
              </p>
              <div className="space-y-2">
                {dailyGoals.map(goal => (
                  <TaskRow
                    key={goal.id}
                    title={goal.title}
                    checked={isDone(goal.id)}
                    sublabel="every day"
                    readOnly={readOnly}
                    onToggle={() => handleToggle(goal.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {weeklyGoals.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
                Weekly
              </p>
              <div className="space-y-2">
                {weeklyGoals.map(goal => (
                  <TaskRow
                    key={goal.id}
                    title={goal.title}
                    checked={isDone(goal.id)}
                    sublabel={`${weekCount(goal.id)}/${goal.frequency.daysPerWeek} this week`}
                    readOnly={readOnly}
                    onToggle={() => handleToggle(goal.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-2">
          <button
            onClick={onClose}
            className="w-full bg-orange-500 hover:bg-orange-400 text-white font-semibold rounded-xl py-3 text-sm transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

interface TaskRowProps {
  title: string
  checked: boolean
  sublabel: string
  onToggle: () => void
  readOnly?: boolean
}

function TaskRow({ title, checked, sublabel, onToggle, readOnly }: TaskRowProps) {
  const Elem = readOnly ? 'div' : 'button'
  return (
    <Elem
      {...(!readOnly && { onClick: onToggle })}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left ${
        readOnly ? '' : 'transition-colors'
      } ${checked ? 'bg-gray-100/60 dark:bg-gray-800/60' : 'bg-gray-100 dark:bg-gray-800'}`}
    >
      <div className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
        checked ? 'bg-orange-500 border-orange-500' : 'border-gray-400 dark:border-gray-500'
      }`}>
        {checked && (
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <span className={`flex-1 text-sm font-medium truncate ${
        checked ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white'
      }`}>
        {title}
      </span>
      <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{sublabel}</span>
    </Elem>
  )
}
