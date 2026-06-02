import type { Goal, Completion, UserProfile, Post } from '@/types'

import { weekStart, weekEnd, toETDateString } from './time'

// The five Sun–Sat weeks that cover June 2026
const JUNE_WEEKS = [1, 7, 14, 21, 28].map(d => {
  const date = `2026-06-${String(d).padStart(2, '0')}`
  return { start: weekStart(date), end: weekEnd(date) }
})

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

  // Beast score: 1pt/completion + 3pts/perfect day + 10pts/perfect week + 2pts/post day
  const beastScore = totalSessions + perfectDays * 3 + perfectWeeks * 10 + postDays * 2

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

function getTop3(
  users: UserProfile[],
  getValue: (s: UserStats) => number,
  formatLabel: (n: number) => string,
  statsMap: Map<string, UserStats>,
): { entries: RankEntry[]; maxScore: number } {
  const EMPTY: UserStats = { beastScore: 0, perfectDays: 0, totalSessions: 0, longestStreak: 0, feedPosts: 0, postDays: 0, weeklyGoalsMet: 0 }
  const sorted = users
    .map(u => ({ uid: u.uid, score: getValue(statsMap.get(u.uid) ?? EMPTY) }))
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
): LeaderboardMetric[] {
  const statsMap = new Map<string, UserStats>()
  for (const user of users) {
    statsMap.set(user.uid, computeStats(user.uid, allGoals, allCompletions, allPosts, today))
  }

  const top3 = (get: (s: UserStats) => number, fmt: (n: number) => string, subset?: UserProfile[]) => {
    const { entries, maxScore } = getTop3(subset ?? users, get, fmt, statsMap)
    return { entries, maxScore }
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
