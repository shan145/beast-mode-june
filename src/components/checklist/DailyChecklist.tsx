import confetti from 'canvas-confetti'
import { addCompletion, removeCompletion } from '@/lib/firestore'
import { todayET, weekStart, weekEnd } from '@/lib/time'
import type { Goal, Completion } from '@/types'
import TaskItem from './TaskItem'

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

    const weekCount = completions.filter(
      c => c.goalId === goal.id && c.date >= ws && c.date <= we
    ).length
    const quotaMet = weekCount >= goal.frequency.daysPerWeek
    return { goal, checked: doneToday || quotaMet, locked: quotaMet && !doneToday, weekCount }
  })
}

function allTasksDone(goals: Goal[], completions: Completion[], today: string): boolean {
  if (goals.length === 0) return false
  const ws = weekStart(today)
  const we = weekEnd(today)

  return goals.every(goal => {
    const doneToday = completions.some(c => c.goalId === goal.id && c.date === today)
    if (goal.frequency.type === 'daily') return doneToday
    const weekCount = completions.filter(
      c => c.goalId === goal.id && c.date >= ws && c.date <= we
    ).length
    return weekCount >= goal.frequency.daysPerWeek || doneToday
  })
}

function fireItemConfetti(e: React.MouseEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  confetti({
    particleCount: 50,
    spread: 65,
    origin: {
      x: (rect.left + rect.width / 2) / window.innerWidth,
      y: (rect.top + rect.height / 2) / window.innerHeight,
    },
    colors: ['#f97316', '#fb923c', '#fbbf24', '#a3e635'],
    zIndex: 9999,
  })
}

function fireCelebration() {
  const opts = {
    spread: 90,
    startVelocity: 50,
    colors: ['#f97316', '#fb923c', '#fbbf24', '#a3e635', '#34d399', '#818cf8'],
    zIndex: 9999,
  }
  confetti({ ...opts, particleCount: 120, origin: { x: 0.25, y: 0.5 } })
  setTimeout(() => confetti({ ...opts, particleCount: 120, origin: { x: 0.75, y: 0.5 } }), 180)
}

export default function DailyChecklist({ userId, goals, completions, readOnly }: Props) {
  const today = todayET()

  const tasks = buildTasks(goals, completions, today)
  const doneCount = tasks.filter(t => t.checked).length
  const allDone = allTasksDone(goals, completions, today)

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
    if (allTasksDone(goals, optimistic, today)) {
      setTimeout(fireCelebration, 350)
    }
  }

  const label = new Date(today + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })

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
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Today</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">{label}</p>
        </div>
        {goals.length > 0 && (
          <span className={`text-sm font-medium ${allDone ? 'text-emerald-500 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}`}>
            {doneCount}/{tasks.length}
          </span>
        )}
      </div>

      <div className="space-y-2">
        {tasks.map(task => (
          <TaskItem
            key={task.goal.id}
            goal={task.goal}
            checked={task.checked}
            locked={task.locked}
            readOnly={readOnly}
            weekCount={task.goal.frequency.type === 'weekly' ? task.weekCount : undefined}
            onToggle={readOnly ? undefined : e => handleToggle(task, e)}
          />
        ))}
      </div>

      {allDone && (
        <div className="mt-6 text-center py-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800/50">
          <p className="text-emerald-600 dark:text-emerald-400 font-semibold">
            {readOnly ? 'All done today!' : 'All done for today!'}
          </p>
          <p className="text-emerald-500 dark:text-emerald-600 text-sm mt-0.5">
            {readOnly ? "They're crushing it." : 'Keep the streak going.'}
          </p>
        </div>
      )}
    </div>
  )
}
