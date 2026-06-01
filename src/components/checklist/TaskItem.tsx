import type { Goal } from '@/types'

interface Props {
  goal: Goal
  checked: boolean
  // for weekly goals
  weekCount?: number
  // checked but not toggleable (weekly quota met via other days)
  locked?: boolean
  onToggle: (e: React.MouseEvent<HTMLButtonElement>) => void
}

export default function TaskItem({ goal, checked, weekCount, locked, onToggle }: Props) {
  const isWeekly = goal.frequency.type === 'weekly'
  const clickable = !locked

  return (
    <div className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-colors ${
      checked ? 'bg-gray-800/60' : 'bg-gray-800'
    }`}>
      <button
        onClick={clickable ? onToggle : undefined}
        disabled={!clickable}
        className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
          checked
            ? locked
              ? 'bg-emerald-600 border-emerald-600 cursor-default'
              : 'bg-orange-500 border-orange-500'
            : 'border-gray-500 hover:border-orange-400'
        } disabled:cursor-default`}
        aria-label={checked ? 'Mark incomplete' : 'Mark complete'}
      >
        {checked && (
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-tight truncate transition-colors ${
          checked ? 'text-gray-400 line-through' : 'text-white'
        }`}>
          {goal.title}
        </p>
        {goal.description && (
          <p className="text-xs text-gray-500 mt-0.5 truncate">{goal.description}</p>
        )}
      </div>

      <div className="shrink-0 text-right">
        {isWeekly ? (
          <span className={`text-xs font-medium ${
            locked ? 'text-emerald-500' : 'text-gray-500'
          }`}>
            {locked
              ? `${weekCount}/${goal.frequency.daysPerWeek} ✓`
              : `${weekCount}/${goal.frequency.daysPerWeek} this week`}
          </span>
        ) : (
          <span className="text-xs text-gray-600">every day</span>
        )}
      </div>
    </div>
  )
}
