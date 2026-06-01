import type { Goal } from '@/types'

interface Props {
  goal: Goal
  onEdit: () => void
  onDelete: () => void
}

export default function GoalCard({ goal, onEdit, onDelete }: Props) {
  const { title, description, frequency } = goal

  return (
    <div className="bg-gray-900 rounded-xl p-4 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-white font-medium">{title}</h3>
          <span className="text-xs bg-gray-800 text-gray-400 rounded-full px-2 py-0.5 shrink-0">
            {frequency.type === 'daily' ? 'daily' : `${frequency.daysPerWeek}×/week`}
          </span>
        </div>
        {description && (
          <p className="text-gray-400 text-sm mt-0.5">{description}</p>
        )}
        <p className="text-gray-500 text-xs mt-1">
          {frequency.daysPerWeek} days/week · {frequency.totalDays} day June target
        </p>
      </div>
      <div className="flex gap-3 shrink-0 mt-0.5">
        <button
          onClick={onEdit}
          className="text-gray-400 hover:text-white text-sm transition"
        >
          Edit
        </button>
        <button
          onClick={onDelete}
          className="text-gray-400 hover:text-red-400 text-sm transition"
        >
          Delete
        </button>
      </div>
    </div>
  )
}
