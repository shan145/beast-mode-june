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
  weeklyBeastScore: number
  perfectDays: number
  totalSessions: number
  longestStreak: number
  feedPosts: number
  weekFeedPosts: number
  postDays: number
  weeklyGoalsMet: number
}

// ── Per-week Beast Score scoring (shared by stats, breakdowns, and the archive) ──

export type BreakdownChip = { text: string; color: 'green' | 'red' | 'orange' | 'gray' }

export interface BreakdownLine {
  label: string
  parts?: BreakdownChip[]
  pts: number
  isBonus?: boolean
}

interface WeekScore {
  weekPts: number
  weekDone: boolean
  lines: BreakdownLine[]
}

// Scores a single Sun–Sat week for one user's goals, producing both the point
// total and the line-item breakdown (so both can be derived from one pass).
function computeWeekScore(
  week: { start: string; end: string },
  dailyGoals: Goal[],
  weeklyGoals: Goal[],
  comps: Completion[],
  today: string,
): WeekScore {
  const weekDone = week.end <= today
  const elapsed = daysInWeek(week, today)
  const lines: BreakdownLine[] = []
  let weekPts = 0

  // Daily goals: +2 per completion, -1 per miss (past days only — today is not yet
  // penalized, UNLESS today is the week's last day, in which case the week is being
  // scored as "done" and an incomplete today must count as a miss for the bonus check)
  let perfectDailyWeek = dailyGoals.length > 0
  for (const goal of dailyGoals) {
    let done = 0, missed = 0
    for (const date of elapsed) {
      if (comps.some(c => c.goalId === goal.id && c.date === date)) done++
      else if (date < today || (date === today && weekDone)) missed++
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

  // Weekly goals: +3 per completion (up to quota), +5 per goal when quota met,
  // -2 per missed session (only after week ends), +10 when all quotas met
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
    lines.push({ label: `${goal.title} (${goal.frequency.daysPerWeek}×/wk)`, parts, pts })
  }
  if (allWeeklyMet) {
    weekPts += 10
    lines.push({ label: 'All weekly goals met', pts: 10, isBonus: true })
  }

  // Beast week combo: all dailies perfect + all weekly quotas met (only confirmed at week end)
  if (weekDone && dailyGoals.length > 0 && weeklyGoals.length > 0 && perfectDailyWeek && allWeeklyMet) {
    weekPts += 25
    lines.push({ label: 'Beast Week', pts: 25, isBonus: true })
  }

  return { weekPts, weekDone, lines }
}

// Unique post days (max 1 credit/day, ET) a user logged within `[start, end]`
function postDaysInRange(uid: string, allPosts: Post[], start: string, end: string): number {
  const daySet = new Set<string>()
  for (const p of allPosts.filter(p => p.userId === uid)) {
    if (!p.createdAt) continue
    const dateStr = toETDateString(p.createdAt.toDate())
    if (dateStr >= start && dateStr <= end) daySet.add(dateStr)
  }
  return daySet.size
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
  const currentWeekStart = weekStart(today)
  const currentWeekEnd = weekEnd(today)

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
  const postDays = postDaysInRange(uid, allPosts, '2026-06-01', '2026-06-30')

  // Beast score: per-week accounting with bonuses and penalties.
  // Resets each week — `weeklyBeastScore` tracks only the week containing `today`.
  let beastScore = 0
  let weeklyBeastScore = 0
  for (const week of JUNE_WEEKS) {
    if (week.start > today) break
    const { weekPts } = computeWeekScore(week, dailyGoals, weeklyGoals, comps, today)
    beastScore += weekPts
    if (week.start === currentWeekStart) weeklyBeastScore = weekPts
  }
  beastScore += postDays * 2
  beastScore = Math.max(0, beastScore)

  // Feed posting within the current week only — resets weekly alongside the score
  const weekFeedPosts = allPosts.filter(p => {
    if (p.userId !== uid || !p.createdAt) return false
    const dateStr = toETDateString(p.createdAt.toDate())
    return dateStr >= currentWeekStart && dateStr <= currentWeekEnd
  }).length
  const weekPostDays = postDaysInRange(uid, allPosts, currentWeekStart, currentWeekEnd)
  weeklyBeastScore = Math.max(0, weeklyBeastScore + weekPostDays * 2)

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

  return { beastScore, weeklyBeastScore, perfectDays, totalSessions, longestStreak, feedPosts, weekFeedPosts, postDays, weeklyGoalsMet }
}

const EMPTY_STATS: UserStats = { beastScore: 0, weeklyBeastScore: 0, perfectDays: 0, totalSessions: 0, longestStreak: 0, feedPosts: 0, weekFeedPosts: 0, postDays: 0, weeklyGoalsMet: 0 }

// ── Ranking primitives — operate on plain (uid, score) pairs so they can rank
// either live UserStats-derived scores or one-off per-week archive scores ──────

interface ScoredUser { uid: string; score: number }

function rankOfUser(
  uid: string,
  scored: ScoredUser[],
  formatLabel: (n: number) => string,
): RankEntry | undefined {
  if (!scored.some(s => s.uid === uid)) return undefined
  const sorted = [...scored].sort((a, b) => b.score - a.score)

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

function rankTop3(
  scored: ScoredUser[],
  formatLabel: (n: number) => string,
): { entries: RankEntry[]; maxScore: number } {
  const sorted = [...scored].sort((a, b) => b.score - a.score)

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

function getUserRankEntry(
  uid: string,
  eligibleUsers: UserProfile[],
  getValue: (s: UserStats) => number,
  formatLabel: (n: number) => string,
  statsMap: Map<string, UserStats>,
): RankEntry | undefined {
  if (!eligibleUsers.some(u => u.uid === uid)) return undefined
  const scored = eligibleUsers.map(u => ({ uid: u.uid, score: getValue(statsMap.get(u.uid) ?? EMPTY_STATS) }))
  return rankOfUser(uid, scored, formatLabel)
}

function getTop3(
  users: UserProfile[],
  getValue: (s: UserStats) => number,
  formatLabel: (n: number) => string,
  statsMap: Map<string, UserStats>,
): { entries: RankEntry[]; maxScore: number } {
  const scored = users.map(u => ({ uid: u.uid, score: getValue(statsMap.get(u.uid) ?? EMPTY_STATS) }))
  return rankTop3(scored, formatLabel)
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
    { id: 'beast',        name: 'Beast Score',      description: 'Tap ⓘ to see how points are calculated',                ...top3(s => s.weeklyBeastScore, pts,       undefined)             },
    { id: 'consistent',   name: 'Most Consistent',  description: 'Days with every daily goal completed',                    ...top3(s => s.perfectDays,   days,        usersWithDailyGoals)   },
    { id: 'weekly-grind', name: 'Weekly Grind',      description: 'Weekly goals where full quota was hit',                   ...top3(s => s.weeklyGoalsMet, completions, usersWithWeeklyGoals)  },
    { id: 'sessions',     name: 'Total Completions', description: 'Total completions logged all of June',                   ...top3(s => s.totalSessions, completions, undefined)             },
    { id: 'streak',       name: 'Longest Streak',   description: 'Most consecutive days with any completion',               ...top3(s => s.longestStreak, days,        undefined)             },
    { id: 'feed-posts',   name: 'Feed Posting',      description: 'Posts shared to the feed this week',                     ...top3(s => s.weekFeedPosts, posts,       undefined)             },
  ]
}

// ── Beast Score breakdown ────────────────────────────────────────────────────

export interface WeekBreakdown {
  label: string
  total: number
  weekDone: boolean
  lines: BreakdownLine[]
}

export interface BeastBreakdown {
  totalScore: number
  currentWeekScore: number
  weeks: WeekBreakdown[]
  postDays: number
  postPts: number
  currentWeekPostDays: number
  currentWeekPostPts: number
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
  const currentWeekStart = weekStart(today)
  const currentWeekEnd = weekEnd(today)

  const postDays = postDaysInRange(uid, allPosts, '2026-06-01', '2026-06-30')
  const postPts = postDays * 2
  const currentWeekPostDays = postDaysInRange(uid, allPosts, currentWeekStart, currentWeekEnd)

  let totalScore = postPts
  let currentWeekBaseScore = 0
  const weeks: WeekBreakdown[] = []

  for (const week of JUNE_WEEKS) {
    if (week.start > today) break
    const elapsed = daysInWeek(week, today)
    if (elapsed.length === 0) continue

    const { weekPts, weekDone, lines } = computeWeekScore(week, dailyGoals, weeklyGoals, comps, today)
    totalScore += weekPts
    if (week.start === currentWeekStart) currentWeekBaseScore = weekPts
    weeks.push({ label: formatWeekLabel(week), total: weekPts, weekDone, lines })
  }

  const currentWeekScore = Math.max(0, currentWeekBaseScore + currentWeekPostDays * 2)
  const currentWeekPostPts = currentWeekPostDays * 2

  return { totalScore, currentWeekScore, weeks, postDays, postPts, currentWeekPostDays, currentWeekPostPts }
}

// ── Beast Score trophy archive — past completed weeks' top 3 + your rank ────────

export interface WeekArchiveEntry {
  weekIndex: number
  label: string
  entries: RankEntry[]
  myEntry?: RankEntry
}

const beastPts = (n: number) => `${n} pt${n !== 1 ? 's' : ''}`

// Returns one entry per fully-completed week before the current one (most recent first),
// each ranking every user by THAT week's Beast Score alone — a snapshot of who was on
// top before the score reset for the next week.
export function computeBeastArchive(
  users: UserProfile[],
  allGoals: Goal[],
  allCompletions: Completion[],
  allPosts: Post[],
  today: string,
  currentUserId?: string,
): WeekArchiveEntry[] {
  const currentWeekStart = weekStart(today)
  const archive: WeekArchiveEntry[] = []

  for (let weekIndex = 0; weekIndex < JUNE_WEEKS.length; weekIndex++) {
    const week = JUNE_WEEKS[weekIndex]
    if (week.start >= currentWeekStart) break

    const scored: ScoredUser[] = users.map(u => {
      const goals = allGoals.filter(g => g.userId === u.uid)
      const comps = allCompletions.filter(c => c.userId === u.uid)
      const dailyGoals = goals.filter(g => g.frequency.type === 'daily')
      const weeklyGoals = goals.filter(g => g.frequency.type === 'weekly')
      const { weekPts } = computeWeekScore(week, dailyGoals, weeklyGoals, comps, today)
      const postPts = postDaysInRange(u.uid, allPosts, week.start, week.end) * 2
      return { uid: u.uid, score: Math.max(0, weekPts + postPts) }
    })

    const { entries } = rankTop3(scored, beastPts)
    let myEntry: RankEntry | undefined
    if (currentUserId && !entries.some(e => e.uid === currentUserId)) {
      myEntry = rankOfUser(currentUserId, scored, beastPts)
    }

    archive.push({ weekIndex, label: formatWeekLabel(week), entries, myEntry })
  }

  return archive.reverse()
}

export interface WeekOnlyBreakdown {
  label: string
  total: number
  lines: BreakdownLine[]
  postDays: number
  postPts: number
}

// Single-week version of computeBeastBreakdown — for drilling into a contestant's
// score for one specific past week from the trophy archive.
export function computeWeekOnlyBreakdown(
  uid: string,
  weekIndex: number,
  allGoals: Goal[],
  allCompletions: Completion[],
  allPosts: Post[],
  today: string,
): WeekOnlyBreakdown {
  const week = JUNE_WEEKS[weekIndex]
  const goals = allGoals.filter(g => g.userId === uid)
  const comps = allCompletions.filter(c => c.userId === uid)
  const dailyGoals = goals.filter(g => g.frequency.type === 'daily')
  const weeklyGoals = goals.filter(g => g.frequency.type === 'weekly')

  const { weekPts, lines } = computeWeekScore(week, dailyGoals, weeklyGoals, comps, today)
  const postDays = postDaysInRange(uid, allPosts, week.start, week.end)
  const postPts = postDays * 2

  return { label: formatWeekLabel(week), total: Math.max(0, weekPts + postPts), lines, postDays, postPts }
}
