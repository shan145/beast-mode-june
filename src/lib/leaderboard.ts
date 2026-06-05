import type { Goal, Completion, UserProfile, Post } from '@/types'

import { weekStart, weekEnd, toETDateString } from './time'

// The five Sun–Sat weeks that cover June 2026
const JUNE_WEEKS = [1, 7, 14, 21, 28].map(d => {
  const date = `2026-06-${String(d).padStart(2, '0')}`
  return { start: weekStart(date), end: weekEnd(date) }
})

// June days in `week` that have elapsed as of `today`, clipped to June 1–30
function daysInWeek(week: { start: string; end: string }, today: string): string[] {
  const days: string[] = []
  const start = week.start < '2026-06-01' ? '2026-06-01' : week.start
  const end = week.end < today ? week.end : today
  if (start > end) return days
  const [sy, sm, sd] = start.split('-').map(Number)
  const d = new Date(sy, sm - 1, sd)
  while (true) {
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (dateStr > end) break
    days.push(dateStr)
    d.setDate(d.getDate() + 1)
  }
  return days
}

function juneDaysUpTo(today: string): string[] {
  const days: string[] = []
  for (let d = 1; d <= 30; d++) {
    const date = `2026-06-${String(d).padStart(2, '0')}`
    if (date <= today) days.push(date)
  }
  return days
}

export interface RankEntry {
  rank: number
  uid: string
  score: number
  scoreLabel: string
}

export interface LeaderboardMetric {
  id: string
  name: string
  description: string
  maxScore: number
  entries: RankEntry[]
  myEntry?: RankEntry  // current user's rank when they're not in the top-3 entries
}

interface UserStats {
  beastScore: number
  perfectDays: number
  totalSessions: number
  longestStreak: number
  feedPosts: number
  postDays: number
  weeklyGoalsMet: number
}

function computeStats(
  uid: string,
  allGoals: Goal[],
  allCompletions: Completion[],
  allPosts: Post[],
  today: string,
): UserStats {
  const goals = allGoals.filter(g => g.userId === uid)
  const comps = allCompletions.filter(c => c.userId === uid)
  const dailyGoals = goals.filter(g => g.frequency.type === 'daily')
  const weeklyGoals = goals.filter(g => g.frequency.type === 'weekly')
  const days = juneDaysUpTo(today)

  // Perfect days: all daily goals done on that day
  let perfectDays = 0
  if (dailyGoals.length > 0) {
    for (const date of days) {
      if (dailyGoals.every(g => comps.some(c => c.goalId === g.id && c.date === date))) {
        perfectDays++
      }
    }
  }

  // Perfect weeks: all weekly quotas met
  let perfectWeeks = 0
  if (weeklyGoals.length > 0) {
    for (const week of JUNE_WEEKS) {
      if (week.start > today) break
      const allMet = weeklyGoals.every(g => {
        const count = comps.filter(c => c.goalId === g.id && c.date >= week.start && c.date <= week.end).length
        return count >= g.frequency.daysPerWeek
      })
      if (allMet) perfectWeeks++
    }
  }

  // Total sessions (capped at quota per weekly goal per week to avoid inflating beast score)
  const totalSessions = comps.length

  // Unique June days the user posted to the feed (max 1 credit per day, Eastern Time)
  const postDaySet = new Set<string>()
  for (const p of allPosts.filter(p => p.userId === uid)) {
    if (!p.createdAt) continue
    const dateStr = toETDateString(p.createdAt.toDate())
    if (dateStr >= '2026-06-01' && dateStr <= '2026-06-30') postDaySet.add(dateStr)
  }
  const postDays = postDaySet.size

  // Beast score: per-week accounting with bonuses and penalties
  let beastScore = 0
  for (const week of JUNE_WEEKS) {
    if (week.start > today) break
    const weekDone = week.end <= today
    const elapsed = daysInWeek(week, today)

    let weekPts = 0

    // Daily goals: +2 per completion, -1 per miss (past days only — today is not yet penalized)
    let perfectDailyWeek = dailyGoals.length > 0
    for (const goal of dailyGoals) {
      for (const date of elapsed) {
        if (comps.some(c => c.goalId === goal.id && c.date === date)) {
          weekPts += 2
        } else if (date < today) {
          weekPts -= 1
          perfectDailyWeek = false
        }
      }
    }
    if (perfectDailyWeek && weekDone) weekPts += 10

    // Weekly goals: +3 per completion (up to quota), +5 per goal when quota met,
    // -2 per missed session (only after week ends), +10 when all quotas met
    let allWeeklyMet = weeklyGoals.length > 0
    for (const goal of weeklyGoals) {
      const count = comps.filter(
        c => c.goalId === goal.id && c.date >= week.start && c.date <= week.end
      ).length
      weekPts += Math.min(count, goal.frequency.daysPerWeek) * 3
      if (count >= goal.frequency.daysPerWeek) {
        weekPts += 5
      } else {
        allWeeklyMet = false
        if (weekDone) weekPts -= (goal.frequency.daysPerWeek - count) * 2
      }
    }
    if (allWeeklyMet) weekPts += 10

    // Beast week combo: all dailies perfect + all weekly quotas met (only confirmed at week end)
    if (weekDone && dailyGoals.length > 0 && weeklyGoals.length > 0 && perfectDailyWeek && allWeeklyMet) {
      weekPts += 25
    }

    beastScore += weekPts
  }
  beastScore += postDays * 2
  beastScore = Math.max(0, beastScore)

  // Longest streak: consecutive days with at least one completion
  let longestStreak = 0
  let streak = 0
  for (const date of days) {
    if (comps.some(c => c.date === date)) {
      streak++
      longestStreak = Math.max(longestStreak, streak)
    } else {
      streak = 0
    }
  }

  const feedPosts = allPosts.filter(p => p.userId === uid).length

  // Count (goal × week) pairs where the full quota was met — partial weeks don't count
  let weeklyGoalsMet = 0
  for (const week of JUNE_WEEKS) {
    if (week.start > today) break
    for (const goal of weeklyGoals) {
      const count = comps.filter(c => c.goalId === goal.id && c.date >= week.start && c.date <= week.end).length
      if (count >= goal.frequency.daysPerWeek) weeklyGoalsMet++
    }
  }

  return { beastScore, perfectDays, totalSessions, longestStreak, feedPosts, postDays, weeklyGoalsMet }
}

const EMPTY_STATS: UserStats = { beastScore: 0, perfectDays: 0, totalSessions: 0, longestStreak: 0, feedPosts: 0, postDays: 0, weeklyGoalsMet: 0 }

function getUserRankEntry(
  uid: string,
  eligibleUsers: UserProfile[],
  getValue: (s: UserStats) => number,
  formatLabel: (n: number) => string,
  statsMap: Map<string, UserStats>,
): RankEntry | undefined {
  if (!eligibleUsers.some(u => u.uid === uid)) return undefined
  const sorted = eligibleUsers
    .map(u => ({ uid: u.uid, score: getValue(statsMap.get(u.uid) ?? EMPTY_STATS) }))
    .sort((a, b) => b.score - a.score)

  let i = 0
  let rank = 1
  while (i < sorted.length) {
    const score = sorted[i].score
    const tierStart = i
    while (i < sorted.length && sorted[i].score === score) i++
    if (sorted.slice(tierStart, i).some(e => e.uid === uid)) {
      return { rank, uid, score, scoreLabel: formatLabel(score) }
    }
    rank++
  }
  return undefined
}

function getTop3(
  users: UserProfile[],
  getValue: (s: UserStats) => number,
  formatLabel: (n: number) => string,
  statsMap: Map<string, UserStats>,
): { entries: RankEntry[]; maxScore: number } {
  const sorted = users
    .map(u => ({ uid: u.uid, score: getValue(statsMap.get(u.uid) ?? EMPTY_STATS) }))
    .sort((a, b) => b.score - a.score)

  const maxScore = sorted[0]?.score ?? 0
  const entries: RankEntry[] = []
  let i = 0
  let rank = 1

  // Collect up to 3 distinct score levels; each person in a tier gets their own row
  while (i < sorted.length && rank <= 3) {
    const score = sorted[i].score
    while (i < sorted.length && sorted[i].score === score) {
      entries.push({ rank, uid: sorted[i].uid, score, scoreLabel: formatLabel(score) })
      i++
    }
    rank += 1
  }

  return { entries, maxScore }
}

export function computeLeaderboard(
  users: UserProfile[],
  allGoals: Goal[],
  allCompletions: Completion[],
  allPosts: Post[],
  today: string,
  currentUserId?: string,
): LeaderboardMetric[] {
  const statsMap = new Map<string, UserStats>()
  for (const user of users) {
    statsMap.set(user.uid, computeStats(user.uid, allGoals, allCompletions, allPosts, today))
  }

  const top3 = (get: (s: UserStats) => number, fmt: (n: number) => string, subset?: UserProfile[]) => {
    const eligible = subset ?? users
    const { entries, maxScore } = getTop3(eligible, get, fmt, statsMap)
    let myEntry: RankEntry | undefined
    if (currentUserId && !entries.some(e => e.uid === currentUserId)) {
      myEntry = getUserRankEntry(currentUserId, eligible, get, fmt, statsMap)
    }
    return { entries, maxScore, myEntry }
  }

  // Only include users who actually have daily goals in the consistency ranking
  const usersWithDailyGoals = users.filter(u =>
    allGoals.some(g => g.userId === u.uid && g.frequency.type === 'daily')
  )

  // Only include users with weekly goals for the weekly completions ranking
  const usersWithWeeklyGoals = users.filter(u =>
    allGoals.some(g => g.userId === u.uid && g.frequency.type === 'weekly')
  )

  const pts = (n: number) => `${n} pt${n !== 1 ? 's' : ''}`
  const days = (n: number) => `${n} day${n !== 1 ? 's' : ''}`
  const completions = (n: number) => `${n} completion${n !== 1 ? 's' : ''}`
  const posts = (n: number) => `${n} post${n !== 1 ? 's' : ''}`

  return [
    { id: 'beast',        name: 'Beast Score',      description: 'Tap ⓘ to see how points are calculated',                ...top3(s => s.beastScore,     pts,         undefined)             },
    { id: 'consistent',   name: 'Most Consistent',  description: 'Days with every daily goal completed',                    ...top3(s => s.perfectDays,   days,        usersWithDailyGoals)   },
    { id: 'weekly-grind', name: 'Weekly Grind',      description: 'Weekly goals where full quota was hit',                   ...top3(s => s.weeklyGoalsMet, completions, usersWithWeeklyGoals)  },
    { id: 'sessions',     name: 'Total Completions', description: 'Total completions logged all of June',                   ...top3(s => s.totalSessions, completions, undefined)             },
    { id: 'streak',       name: 'Longest Streak',   description: 'Most consecutive days with any completion',               ...top3(s => s.longestStreak, days,        undefined)             },
    { id: 'feed-posts',   name: 'Feed Posting',      description: 'Total posts shared to the feed',                         ...top3(s => s.feedPosts,     posts,       undefined)             },
  ]
}

// ── Beast Score breakdown ────────────────────────────────────────────────────

export type BreakdownChip = { text: string; color: 'green' | 'red' | 'orange' | 'gray' }

export interface BreakdownLine {
  label: string
  parts?: BreakdownChip[]
  pts: number
  isBonus?: boolean
}

export interface WeekBreakdown {
  label: string
  total: number
  weekDone: boolean
  lines: BreakdownLine[]
}

export interface BeastBreakdown {
  totalScore: number
  weeks: WeekBreakdown[]
  postDays: number
  postPts: number
}

function formatWeekLabel(week: { start: string; end: string }): string {
  const start = week.start < '2026-06-01' ? '2026-06-01' : week.start
  const end = week.end > '2026-06-30' ? '2026-06-30' : week.end
  const startDay = Number(start.split('-')[2])
  const endDay = Number(end.split('-')[2])
  return `Jun ${startDay}–${endDay}`
}

export function computeBeastBreakdown(
  uid: string,
  allGoals: Goal[],
  allCompletions: Completion[],
  allPosts: Post[],
  today: string,
): BeastBreakdown {
  const goals = allGoals.filter(g => g.userId === uid)
  const comps = allCompletions.filter(c => c.userId === uid)
  const dailyGoals = goals.filter(g => g.frequency.type === 'daily')
  const weeklyGoals = goals.filter(g => g.frequency.type === 'weekly')

  const postDaySet = new Set<string>()
  for (const p of allPosts.filter(p => p.userId === uid)) {
    if (!p.createdAt) continue
    const dateStr = toETDateString(p.createdAt.toDate())
    if (dateStr >= '2026-06-01' && dateStr <= '2026-06-30') postDaySet.add(dateStr)
  }
  const postDays = postDaySet.size
  const postPts = postDays * 2

  let totalScore = postPts
  const weeks: WeekBreakdown[] = []

  for (const week of JUNE_WEEKS) {
    if (week.start > today) break
    const weekDone = week.end <= today
    const elapsed = daysInWeek(week, today)
    if (elapsed.length === 0) continue

    const lines: BreakdownLine[] = []
    let weekPts = 0

    // Daily goals (today is not penalized — only past days count as misses)
    let perfectDailyWeek = dailyGoals.length > 0
    for (const goal of dailyGoals) {
      let done = 0, missed = 0
      for (const date of elapsed) {
        if (comps.some(c => c.goalId === goal.id && c.date === date)) done++
        else if (date < today) missed++
      }
      if (missed > 0) perfectDailyWeek = false
      const pts = done * 2 - missed
      weekPts += pts
      const parts: BreakdownChip[] = []
      if (done > 0) parts.push({ text: `${done} done`, color: 'green' })
      if (missed > 0) parts.push({ text: `${missed} missed`, color: 'red' })
      lines.push({ label: goal.title, parts, pts })
    }
    if (perfectDailyWeek && weekDone) {
      weekPts += 10
      lines.push({ label: 'Perfect daily week', pts: 10, isBonus: true })
    }

    // Weekly goals
    let allWeeklyMet = weeklyGoals.length > 0
    for (const goal of weeklyGoals) {
      const count = comps.filter(
        c => c.goalId === goal.id && c.date >= week.start && c.date <= week.end
      ).length
      const effective = Math.min(count, goal.frequency.daysPerWeek)
      const basePts = effective * 3
      let quotaBonus = 0, penalty = 0
      if (count >= goal.frequency.daysPerWeek) {
        quotaBonus = 5
      } else {
        allWeeklyMet = false
        if (weekDone) penalty = (goal.frequency.daysPerWeek - count) * 2
      }
      const pts = basePts + quotaBonus - penalty
      weekPts += pts
      const parts: BreakdownChip[] = []
      parts.push({ text: `${effective}/${goal.frequency.daysPerWeek} sessions`, color: count >= goal.frequency.daysPerWeek ? 'green' : 'orange' })
      if (quotaBonus > 0) parts.push({ text: 'quota bonus', color: 'orange' })
      if (penalty > 0) parts.push({ text: `${goal.frequency.daysPerWeek - count} missed`, color: 'red' })
      lines.push({
        label: `${goal.title} (${goal.frequency.daysPerWeek}×/wk)`,
        parts,
        pts,
      })
    }
    if (allWeeklyMet) {
      weekPts += 10
      lines.push({ label: 'All weekly goals met', pts: 10, isBonus: true })
    }

    if (weekDone && dailyGoals.length > 0 && weeklyGoals.length > 0 && perfectDailyWeek && allWeeklyMet) {
      weekPts += 25
      lines.push({ label: 'Beast Week', pts: 25, isBonus: true })
    }

    totalScore += weekPts
    weeks.push({ label: formatWeekLabel(week), total: weekPts, weekDone, lines })
  }

  return { totalScore, weeks, postDays, postPts }
}
