import type { CalendarDayData } from '@/hooks/useCalendar'
import { useTheme } from '@/contexts/ThemeContext'

interface Props {
  day: CalendarDayData | null
  goalColors: Record<string, string>
}

export default function DayCell({ day, goalColors }: Props) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  if (!day) return <div className="rounded-md" />

  const showDots = !day.isFuture && !day.allDailyDone && day.dailyGoalStates.length > 0
  const showCheck = !day.isFuture && day.allDailyDone

  return (
    <div className={`flex flex-col items-center py-2 px-1 rounded-md transition-colors ${
      day.isFuture
        ? 'bg-gray-100/50 dark:bg-gray-900/40'
        : day.isToday
          ? 'bg-gray-200 dark:bg-gray-800'
          : 'bg-gray-50 dark:bg-gray-900'
    }`}>
      {/* Day number */}
      <div className={`w-7 h-7 flex items-center justify-center text-xs font-semibold rounded-full leading-none ${
        showCheck
          ? 'bg-orange-500 text-white ring-2 ring-orange-400/30'
          : day.isToday
            ? 'bg-orange-500 text-white'
            : day.isFuture
              ? 'text-gray-400 dark:text-gray-600'
              : 'text-gray-900 dark:text-white'
      }`}>
        {day.dayNum}
      </div>

      {/* Completion dots (partial) */}
      {showDots && (
        <div className="flex flex-wrap gap-0.5 justify-center mt-1.5">
          {day.dailyGoalStates.slice(0, 5).map(gs => (
            <div
              key={gs.goalId}
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{
                backgroundColor: gs.complete
                  ? (goalColors[gs.goalId] ?? '#f97316')
                  : (isDark ? '#4b5563' : '#d1d5db'),
              }}
            />
          ))}
          {day.dailyGoalStates.length > 5 && (
            <span className="text-gray-400 dark:text-gray-500" style={{ fontSize: '8px', lineHeight: '8px' }}>
              +{day.dailyGoalStates.length - 5}
            </span>
          )}
        </div>
      )}

      {/* All-done checkmark */}
      {showCheck && (
        <div className="mt-1">
          <svg className="w-3 h-3 text-orange-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      {/* Spacer so cells stay same height when no dots/check */}
      {!showDots && !showCheck && !day.isFuture && day.dailyGoalStates.length > 0 && (
        <div className="mt-1 h-3" />
      )}
    </div>
  )
}
