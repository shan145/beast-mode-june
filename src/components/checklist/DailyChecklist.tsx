import { useState } from 'react'
import confetti from 'canvas-confetti'
import { addCompletion, removeCompletion } from '@/lib/firestore'
import { todayET, weekStart, weekEnd } from '@/lib/time'
import type { Goal, Completion } from '@/types'
import TaskItem from './TaskItem'
import CelebrationToast from './CelebrationToast'
import ProgressRing from '@/components/ui/ProgressRing'
import { sendNotification } from '@/lib/pushNotifications'
import { auth } from '@/lib/firebase'

interface Props {
  userId: string
  goals: Goal[]
  completions: Completion[]
  readOnly?: boolean
}

interface Task {
  goal: Goal
  checked: boolean
  locked: boolean
  weekCount: number
}

function buildTasks(goals: Goal[], completions: Completion[], today: string): Task[] {
  const ws = weekStart(today)
  const we = weekEnd(today)
  return goals.map(goal => {
    const doneToday = completions.some(c => c.goalId === goal.id && c.date === today)
    if (goal.frequency.type === 'daily') {
      return { goal, checked: doneToday, locked: false, weekCount: 0 }
    }
    const weekCount = completions.filter(c => c.goalId === goal.id && c.date >= ws && c.date <= we).length
    const quotaMet = weekCount >= goal.frequency.daysPerWeek
    return { goal, checked: doneToday || quotaMet, locked: quotaMet && !doneToday, weekCount }
  })
}

function fireItemConfetti(e: React.MouseEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  confetti({
    particleCount: 50, spread: 65,
    origin: { x: (rect.left + rect.width / 2) / window.innerWidth, y: (rect.top + rect.height / 2) / window.innerHeight },
    colors: ['#f97316', '#fb923c', '#fbbf24', '#a3e635'],
    zIndex: 9999,
  })
}

function fireDailyCelebration() {
  confetti({
    particleCount: 120, spread: 80, startVelocity: 45,
    origin: { x: 0.5, y: 0.4 },
    colors: ['#f97316', '#fb923c', '#fbbf24', '#a3e635'],
    zIndex: 9998,
  })
}

function fireWeeklyCelebration() {
  const colors = ['#f97316', '#fbbf24', '#34d399', '#818cf8', '#fb923c', '#10b981']
  const base = { spread: 100, startVelocity: 65, zIndex: 9998, colors }
  confetti({ ...base, particleCount: 180, origin: { x: 0.2, y: 0.6 }, angle: 60 })
  confetti({ ...base, particleCount: 180, origin: { x: 0.8, y: 0.6 }, angle: 120 })
  setTimeout(() => {
    confetti({ ...base, particleCount: 120, spread: 130, origin: { x: 0.5, y: 0.3 } })
  }, 250)
}

export default function DailyChecklist({ userId, goals, completions, readOnly }: Props) {
  const today = todayET()
  const ws = weekStart(today)
  const we = weekEnd(today)

  const dailyGoals = goals.filter(g => g.frequency.type === 'daily')
  const weeklyGoals = goals.filter(g => g.frequency.type === 'weekly')

  const allTasks = buildTasks(goals, completions, today)
  const dailyTasks = allTasks.filter(t => t.goal.frequency.type === 'daily')
  const weeklyTasks = allTasks.filter(t => t.goal.frequency.type === 'weekly')

  const dailyDoneCount = dailyTasks.filter(t => t.checked).length
  const weeklyMetCount = weeklyGoals.filter(g => {
    const count = completions.filter(c => c.goalId === g.id && c.date >= ws && c.date <= we).length
    return count >= g.frequency.daysPerWeek
  }).length

  // Ring uses actual sessions done / total sessions required across all weekly goals
  // Each goal contributes min(done, quota) so over-achievement doesn't inflate the arc
  const weeklySessionsDone = weeklyGoals.reduce((sum, g) => {
    const count = completions.filter(c => c.goalId === g.id && c.date >= ws && c.date <= we).length
    return sum + Math.min(count, g.frequency.daysPerWeek)
  }, 0)
  const weeklySessionsRequired = weeklyGoals.reduce((sum, g) => sum + g.frequency.daysPerWeek, 0)

  const [celebration, setCelebration] = useState<'daily' | 'weekly' | 'weekly-log' | null>(null)

  const label = new Date(today + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })

  async function handleToggle(task: Task, e: React.MouseEvent<HTMLButtonElement>) {
    if (readOnly) return
    const doneToday = completions.some(c => c.goalId === task.goal.id && c.date === today)

    if (doneToday) {
      await removeCompletion(userId, task.goal.id, today)
      return
    }
    if (task.locked) return

    fireItemConfetti(e)
    await addCompletion(userId, task.goal.id, today)

    const optimistic: Completion[] = [
      ...completions,
      { id: '_opt', goalId: task.goal.id, userId, date: today, completedAt: null as any },
    ]

    // Check if daily goals just all became done
    const nowDailyDone = dailyGoals.length > 0 &&
      dailyGoals.every(g => optimistic.some(c => c.goalId === g.id && c.date === today))
    const wasDailyDone = dailyGoals.length > 0 &&
      dailyGoals.every(g => completions.some(c => c.goalId === g.id && c.date === today))

    // Check if weekly quotas just all became met
    const nowWeeklyDone = weeklyGoals.length > 0 && weeklyGoals.every(g => {
      const count = optimistic.filter(c => c.goalId === g.id && c.date >= ws && c.date <= we).length
      return count >= g.frequency.daysPerWeek
    })
    const wasWeeklyDone = weeklyGoals.length > 0 && weeklyGoals.every(g => {
      const count = completions.filter(c => c.goalId === g.id && c.date >= ws && c.date <= we).length
      return count >= g.frequency.daysPerWeek
    })

    const name = auth.currentUser?.displayName ?? 'Someone'

    if (nowWeeklyDone && !wasWeeklyDone) {
      setTimeout(fireWeeklyCelebration, 300)
      setCelebration('weekly')
      // Worker enforces once-per-week idempotency via KV
      sendNotification('weekly-complete', { userName: name, weekStart: ws }, { excludeUserId: userId })
    } else if (nowDailyDone && !wasDailyDone) {
      setTimeout(fireDailyCelebration, 300)
      setCelebration('daily')
      // Worker enforces once-per-day idempotency via KV
      sendNotification('daily-complete', { userName: name, date: today }, { excludeUserId: userId })
    } else if (task.goal.frequency.type === 'weekly') {
      setCelebration('weekly-log')
    }
  }

  if (goals.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400 dark:text-gray-500">
        <p className="text-lg mb-1 text-gray-500 dark:text-gray-400">No goals yet</p>
        <p className="text-sm">
          {readOnly ? "This member hasn't added any goals." : 'Add goals in the Goals tab to start tracking.'}
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Progress rings */}
      {(dailyGoals.length > 0 || weeklyGoals.length > 0) && (
        <div className="flex gap-10 justify-center mb-8">
          {dailyGoals.length > 0 && (
            <ProgressRing
              value={dailyDoneCount}
              max={dailyGoals.length}
              color="#f97316"
              label="Daily"
            />
          )}
          {weeklyGoals.length > 0 && (
            <ProgressRing
              value={weeklySessionsDone}
              max={weeklySessionsRequired}
              color="#3b82f6"
              label="Weekly"
            />
          )}
        </div>
      )}

      {/* Date */}
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Today</h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">{label}</p>
      </div>

      {/* Daily section */}
      {dailyGoals.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Daily
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-600">
              {dailyDoneCount}/{dailyGoals.length}
            </span>
          </div>
          <div className="space-y-2">
            {dailyTasks.map(task => (
              <TaskItem
                key={task.goal.id}
                goal={task.goal}
                checked={task.checked}
                locked={task.locked}
                readOnly={readOnly}
                onToggle={readOnly ? undefined : e => handleToggle(task, e)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Weekly section */}
      {weeklyGoals.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Weekly
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-600">
              {weeklyMetCount}/{weeklyGoals.length} quotas met
            </span>
          </div>
          <div className="space-y-2">
            {weeklyTasks.map(task => (
              <TaskItem
                key={task.goal.id}
                goal={task.goal}
                checked={task.checked}
                locked={task.locked}
                readOnly={readOnly}
                weekCount={task.weekCount}
                onToggle={readOnly ? undefined : e => handleToggle(task, e)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Celebration toast */}
      {celebration && !readOnly && (
        <CelebrationToast
          type={celebration}
          onDismiss={() => setCelebration(null)}
        />
      )}
    </>
  )
}
