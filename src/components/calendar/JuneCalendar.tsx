import { useState } from 'react'
import { useCalendar } from '@/hooks/useCalendar'
import { useTheme } from '@/contexts/ThemeContext'
import { todayET } from '@/lib/time'
import WeekRow from './WeekRow'
import DayLogModal from './DayLogModal'
import type { Goal, Completion } from '@/types'

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

const PALETTE = [
  '#f97316', '#3b82f6', '#a855f7', '#10b981', '#ef4444', '#f59e0b', '#06b6d4',
]

interface Props {
  goals: Goal[]
  completions: Completion[]
  userId?: string   // if provided, past day cells are clickable for retroactive logging
}

export default function JuneCalendar({ goals, completions, userId }: Props) {
  const { weeks } = useCalendar(goals, completions)
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const today = todayET()

  const [logDate, setLogDate] = useState<string | null>(null)

  const sortedGoals = [...goals].sort((a, b) => a.id.localeCompare(b.id))
  const goalColors: Record<string, string> = {}
  sortedGoals.forEach((g, i) => { goalColors[g.id] = PALETTE[i % PALETTE.length] })

  const dailyGoals = sortedGoals.filter(g => g.frequency.type === 'daily')
  const weeklyGoals = sortedGoals.filter(g => g.frequency.type === 'weekly')

  function handleDayClick(date: string) {
    if (!userId) return
    setLogDate(date)
  }

  return (
    <>
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">June 2026</h2>

        {/* Day-of-week header */}
        <div className="grid grid-cols-7 mb-1">
          {DOW.map((label, i) => (
            <div key={i} className="text-center text-xs font-medium text-gray-400 dark:text-gray-500 py-1">
              {label}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div>
          {weeks.map((week, i) => (
            <WeekRow
              key={i}
              week={week}
              goalColors={goalColors}
              onDayClick={userId ? handleDayClick : undefined}
            />
          ))}
        </div>

        {userId && (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-3">
            Tap any past day to log completions
          </p>
        )}

        {goals.length === 0 && (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500">
            <p className="text-sm">Add goals to see your progress here.</p>
          </div>
        )}

        {/* Daily goals legend */}
        {dailyGoals.length > 0 && (
          <div className="mt-5 pt-4 border-t border-gray-200 dark:border-gray-800">
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-2 uppercase tracking-wide font-medium">Daily</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {dailyGoals.map(g => (
                <div key={g.id} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: goalColors[g.id] }} />
                  {g.title}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Weekly goals — per-week progress bars */}
        {weeklyGoals.length > 0 && (
          <div className="mt-5 pt-4 border-t border-gray-200 dark:border-gray-800">
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-3 uppercase tracking-wide font-medium">Weekly</p>
            <div className="space-y-4">
              {weeklyGoals.map(goal => {
                const color = goalColors[goal.id]
                const totalCompletions = completions.filter(c => c.goalId === goal.id).length

                return (
                  <div key={goal.id}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-sm text-gray-900 dark:text-white font-medium">{goal.title}</span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">{goal.frequency.daysPerWeek}× / week</span>
                      </div>
                      <span className="text-xs text-gray-400 dark:text-gray-500">{totalCompletions} total</span>
                    </div>

                    <div className="flex gap-1.5 pl-4">
                      {weeks.map((week, i) => {
                        const ws = week.weeklyGoalStates.find(s => s.goal.id === goal.id)
                        const met = ws?.quotaMet ?? false
                        const weekStarted = week.weekStartDate !== '' && week.weekStartDate <= today
                        const weekCount = ws?.weekCount ?? 0
                        const pct = ws
                          ? Math.min(100, Math.round((weekCount / goal.frequency.daysPerWeek) * 100))
                          : 0

                        return (
                          <div key={i} className="flex-1 flex flex-col gap-0.5">
                            <div
                              className="h-2 rounded-full overflow-hidden"
                              style={{ backgroundColor: isDark ? '#1f2937' : '#e5e7eb' }}
                              title={`Week ${i + 1}: ${weekCount}/${goal.frequency.daysPerWeek}`}
                            >
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${pct}%`,
                                  backgroundColor: met ? '#10b981' : (weekStarted ? color : 'transparent'),
                                  opacity: weekStarted ? 1 : 0,
                                }}
                              />
                            </div>
                            <span
                              className={`text-center ${met ? 'text-emerald-500' : 'text-gray-400 dark:text-gray-600'}`}
                              style={{ fontSize: '9px' }}
                            >
                              W{i + 1}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {logDate && userId && (
        <DayLogModal
          date={logDate}
          userId={userId}
          goals={goals}
          completions={completions}
          onClose={() => setLogDate(null)}
        />
      )}
    </>
  )
}
