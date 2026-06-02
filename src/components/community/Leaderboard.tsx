import { useState, useMemo } from 'react'
import { computeLeaderboard, type RankEntry } from '@/lib/leaderboard'
import { todayET } from '@/lib/time'
import type { UserProfile, Goal, Completion } from '@/types'

interface Props {
  users: UserProfile[]
  allGoals: Goal[]
  allCompletions: Completion[]
  currentUserId?: string
  onMemberClick: (uid: string) => void
}

const AVATAR_COLORS = ['#f97316', '#3b82f6', '#a855f7', '#10b981', '#ef4444', '#f59e0b', '#06b6d4']

function avatarColor(uid: string) {
  const hash = uid.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

const MEDALS = {
  1: { gradient: 'linear-gradient(135deg,#fde68a,#f59e0b)', text: '#78350f', bar: '#f59e0b' },
  2: { gradient: 'linear-gradient(135deg,#e2e8f0,#94a3b8)', text: '#1e293b', bar: '#94a3b8' },
  3: { gradient: 'linear-gradient(135deg,#fcd9b0,#b45309)', text: '#fef3c7', bar: '#b45309' },
} as Record<number, { gradient: string; text: string; bar: string }>

export default function Leaderboard({ users, allGoals, allCompletions, currentUserId, onMemberClick }: Props) {
  const [idx, setIdx] = useState(0)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const today = todayET()

  const metrics = useMemo(
    () => computeLeaderboard(users, allGoals, allCompletions, today),
    [users, allGoals, allCompletions, today],
  )

  const metric = metrics[idx]
  const nameMap = Object.fromEntries(users.map(u => [u.uid, u.displayName || u.email || 'Unknown']))

  function prev() {
    setIdx(i => (i - 1 + metrics.length) % metrics.length)
    setExpanded(new Set())
  }
  function next() {
    setIdx(i => (i + 1) % metrics.length)
    setExpanded(new Set())
  }

  function toggleGroup(key: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  // Group flat entries by rank
  const rankGroups = useMemo(() => {
    const map = new Map<number, RankEntry[]>()
    for (const entry of metric.entries) {
      if (!map.has(entry.rank)) map.set(entry.rank, [])
      map.get(entry.rank)!.push(entry)
    }
    return [...map.entries()].map(([rank, entries]) => ({ rank, entries }))
  }, [metric])

  function renderPersonRow(entry: RankEntry, showMedal: boolean, isLast: boolean) {
    const medal = MEDALS[entry.rank] ?? MEDALS[3]
    const isYou = entry.uid === currentUserId
    const name = nameMap[entry.uid] ?? 'Unknown'
    const pct = metric.maxScore > 0 ? (entry.score / metric.maxScore) * 100 : 0

    return (
      <button
        key={entry.uid}
        onClick={() => !isYou ? onMemberClick(entry.uid) : undefined}
        className={`w-full flex items-center gap-3.5 px-5 py-3.5 text-left transition-colors ${
          isYou ? 'bg-orange-50 dark:bg-orange-950/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
        } ${!isLast ? 'border-b border-gray-100 dark:border-gray-800' : ''}`}
      >
        {/* Medal or spacer */}
        {showMedal ? (
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shrink-0 shadow-sm"
            style={{ background: medal.gradient, color: medal.text }}
          >
            {entry.rank}
          </div>
        ) : (
          <div className="w-10 h-10 shrink-0" />
        )}

        {/* Avatar */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
          style={{
            backgroundColor: avatarColor(entry.uid),
            boxShadow: isYou ? '0 0 0 2px #f97316' : undefined,
          }}
        >
          {getInitials(name)}
        </div>

        {/* Name + progress bar */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold truncate ${
            isYou ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-white'
          }`}>
            {name}{isYou && <span className="font-normal text-orange-400 dark:text-orange-500"> · you</span>}
          </p>
          <div className="mt-1.5 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, backgroundColor: medal.bar }}
            />
          </div>
        </div>

        {/* Score */}
        <span className="text-sm font-bold text-gray-800 dark:text-white shrink-0">
          {entry.scoreLabel}
        </span>
      </button>
    )
  }

  return (
    <div className="rounded-2xl overflow-hidden bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 mb-6 shadow-sm">

      {/* Gradient header */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-400 px-5 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={prev}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition text-white shrink-0"
          >
            <ChevronLeft />
          </button>
          <div className="flex-1 text-center min-w-0">
            <p className="font-bold text-white text-base leading-tight">{metric.name}</p>
            <p className="text-orange-100 text-xs mt-0.5">{metric.description}</p>
          </div>
          <button
            onClick={next}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition text-white shrink-0"
          >
            <ChevronRight />
          </button>
        </div>

        <div className="flex justify-center gap-1.5 mt-3">
          {metrics.map((_, i) => (
            <button
              key={i}
              onClick={() => { setIdx(i); setExpanded(new Set()) }}
              className="rounded-full bg-white transition-all"
              style={{ width: i === idx ? 16 : 6, height: 6, opacity: i === idx ? 1 : 0.4 }}
            />
          ))}
        </div>
      </div>

      {/* Rank groups */}
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {rankGroups.length === 0 ? (
          <p className="text-center text-gray-400 dark:text-gray-500 text-sm py-8">
            No activity yet.
          </p>
        ) : (
          rankGroups.map(({ rank, entries }, groupIdx) => {
            const groupKey = `${idx}-${rank}`
            const isGroupExpanded = expanded.has(groupKey)
            const hidden = entries.slice(1)
            const hasMore = hidden.length > 0
            const isLastGroup = groupIdx === rankGroups.length - 1

            return (
              <div key={rank}>
                {/* First person — always visible */}
                {renderPersonRow(entries[0], true, !hasMore && isLastGroup)}

                {/* Expanded: remaining tied people */}
                {isGroupExpanded && hidden.map((entry, i) =>
                  renderPersonRow(entry, false, i === hidden.length - 1 && isLastGroup)
                )}

                {/* Expand / collapse toggle */}
                {hasMore && (
                  <button
                    onClick={() => toggleGroup(groupKey)}
                    className={`w-full flex items-center gap-2 px-5 py-2.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                      !isLastGroup || isGroupExpanded ? 'border-b border-gray-100 dark:border-gray-800' : ''
                    }`}
                  >
                    {/* Spacer aligns with avatar column */}
                    <div className="w-10 h-4 shrink-0" />

                    {/* Mini avatars of hidden people */}
                    {!isGroupExpanded && (
                      <div className="flex items-center">
                        {hidden.slice(0, 3).map((e, i) => (
                          <div
                            key={e.uid}
                            className="w-5 h-5 rounded-full flex items-center justify-center text-white shrink-0"
                            style={{
                              fontSize: 8,
                              fontWeight: 700,
                              backgroundColor: avatarColor(e.uid),
                              marginLeft: i > 0 ? -5 : 0,
                              zIndex: hidden.length - i,
                              boxShadow: '0 0 0 1.5px white',
                            }}
                          >
                            {getInitials(nameMap[e.uid] ?? '')}
                          </div>
                        ))}
                      </div>
                    )}

                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {isGroupExpanded
                        ? 'Show less'
                        : `+ ${hidden.length} more`}
                    </span>

                    <svg
                      className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isGroupExpanded ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function ChevronLeft() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}
