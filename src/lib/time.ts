// All date strings in this app are Eastern Time "YYYY-MM-DD"

const ET_LOCALE = 'en-US'
const ET_TZ = 'America/New_York'

export function todayET(): string {
  return new Date().toLocaleDateString(ET_LOCALE, {
    timeZone: ET_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2')
}

export function toETDateString(date: Date): string {
  return date.toLocaleDateString(ET_LOCALE, {
    timeZone: ET_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2')
}

// Returns "YYYY-MM-DD" for the Sunday that starts the week containing `date`
export function weekStart(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const dayOfWeek = date.getDay() // 0 = Sunday
  date.setDate(date.getDate() - dayOfWeek)
  return toETDateString(date)
}

// Returns "YYYY-MM-DD" for the Saturday that ends the week containing `date`
export function weekEnd(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const dayOfWeek = date.getDay()
  date.setDate(date.getDate() + (6 - dayOfWeek))
  return toETDateString(date)
}

export function isBeforeToday(dateStr: string): boolean {
  return dateStr < todayET()
}

export function isToday(dateStr: string): boolean {
  return dateStr === todayET()
}

// Returns all "YYYY-MM-DD" strings for June 2026, up to and including today
export function juneCalendarDays(): string[] {
  const today = todayET()
  const days: string[] = []
  for (let d = 1; d <= 30; d++) {
    const dateStr = `2026-06-${String(d).padStart(2, '0')}`
    if (dateStr <= today) days.push(dateStr)
  }
  return days
}
