import DayCell from './DayCell'
import type { CalendarWeekData } from '@/hooks/useCalendar'

interface Props {
  week: CalendarWeekData
  goalColors: Record<string, string>
}

export default function WeekRow({ week, goalColors }: Props) {
  return (
    <div className={`rounded-lg mb-1.5 p-1 transition-all ${
      week.allWeeklyMet
        ? 'ring-1 ring-emerald-400/40 dark:ring-emerald-700/50 bg-emerald-50/60 dark:bg-emerald-950/20'
        : ''
    }`}>
      <div className="grid grid-cols-7 gap-1">
        {week.days.map((day, i) => (
          <DayCell key={i} day={day} goalColors={goalColors} />
        ))}
      </div>
    </div>
  )
}
