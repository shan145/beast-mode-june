import { useMemo } from 'react'
import { todayET, weekStart, weekEnd } from '@/lib/time'
import type { Goal, Completion } from '@/types'

export interface CalendarDayData {
  date: string
  dayNum: number
  isToday: boolean
  isFuture: boolean
  dailyGoalStates: { goalId: string; complete: boolean }[]
  allDailyDone: boolean  // true iff has daily goals AND all complete
}

export interface WeeklyGoalState {
  goal: Goal
  weekStart: string
  weekEnd: string
  weekCount: number
  quotaMet: boolean
}

export interface CalendarWeekData {
  weekStartDate: string              // Sunday of this row (may be before June)
  days: (CalendarDayData | null)[]   // always 7 entries; null = outside June
  weeklyGoalStates: WeeklyGoalState[]
  allWeeklyMet: boolean              // true iff has weekly goals AND all quota met
}

// June 1, 2026 is Monday (dayOfWeek = 1 in Sun=0 convention).
// In a Sun–Sat 7-column grid, col 0 of week 0 = May 31 (null), col 1 = Jun 1.
// Formula: dayNum = weekIdx * 7 + col  (1 = first June day, 30 = last)
export function useCalendar(goals: Goal[], completions: Completion[]) {
  const today = todayET()

  return useMemo(() => {
    const dailyGoals = goals.filter(g => g.frequency.type === 'daily')
    const weeklyGoals = goals.filter(g => g.frequency.type === 'weekly')

    const weeks: CalendarWeekData[] = []

    for (let weekIdx = 0; weekIdx < 5; weekIdx++) {
      const days: (CalendarDayData | null)[] = []

      for (let col = 0; col < 7; col++) {
        const dayNum = weekIdx * 7 + col
        if (dayNum < 1 || dayNum > 30) { days.push(null); continue }

        const date = `2026-06-${String(dayNum).padStart(2, '0')}`
        const dailyGoalStates = dailyGoals.map(g => ({
          goalId: g.id,
          complete: completions.some(c => c.goalId === g.id && c.date === date),
        }))

        const allDailyDone =
          dailyGoals.length > 0 && dailyGoalStates.every(gs => gs.complete)

        days.push({
          date,
          dayNum,
          isToday: date === today,
          isFuture: date > today,
          dailyGoalStates,
          allDailyDone,
        })
      }

      const firstDay = days.find((d): d is CalendarDayData => d !== null)
      if (!firstDay) {
        weeks.push({ weekStartDate: '', days, weeklyGoalStates: [], allWeeklyMet: false })
        continue
      }

      const ws = weekStart(firstDay.date)
      const we = weekEnd(firstDay.date)

      const weeklyGoalStates: WeeklyGoalState[] = weeklyGoals.map(goal => {
        const weekCount = completions.filter(
          c => c.goalId === goal.id && c.date >= ws && c.date <= we
        ).length
        return { goal, weekStart: ws, weekEnd: we, weekCount, quotaMet: weekCount >= goal.frequency.daysPerWeek }
      })

      const allWeeklyMet =
        weeklyGoals.length > 0 && weeklyGoalStates.every(s => s.quotaMet)

      weeks.push({ weekStartDate: ws, days, weeklyGoalStates, allWeeklyMet })
    }

    return { weeks }
  }, [goals, completions, today])
}
