import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  computeLeaderboard, computeBeastBreakdown, computeBeastArchive, computeWeekOnlyBreakdown,
  type RankEntry, type BeastBreakdown, type BreakdownChip, type WeekArchiveEntry, type WeekOnlyBreakdown,
  type LeaderboardMetric,
} from '@/lib/leaderboard'
import { todayET } from '@/lib/time'
import type { UserProfile, Goal, Completion, Post } from '@/types'

interface Props {
  users: UserProfile[]
  allGoals: Goal[]
  allCompletions: Completion[]
  allPosts: Post[]
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

export default function Leaderboard({ users, allGoals, allCompletions, allPosts, currentUserId, onMemberClick }: Props) {
  const [idx, setIdx] = useState(0)
  const [showInfo, setShowInfo] = useState(false)
  const [breakdownUid, setBreakdownUid] = useState<string | null>(null)
  const today = todayET()

  const metrics = useMemo(
    () => computeLeaderboard(users, allGoals, allCompletions, allPosts, today, currentUserId),
    [users, allGoals, allCompletions, allPosts, today, currentUserId],
  )

  const beastMetric = useMemo(() => metrics.find(m => m.id === 'beast')!, [metrics])
  const carouselMetrics = useMemo(() => metrics.filter(m => m.id !== 'beast'), [metrics])
  const metric = carouselMetrics[idx]
  const nameMap = useMemo(
    () => Object.fromEntries(users.map(u => [u.uid, u.displayName || u.email || 'Unknown'])),
    [users],
  )

  const archive = useMemo(
    () => computeBeastArchive(users, allGoals, allCompletions, allPosts, today, currentUserId),
    [users, allGoals, allCompletions, allPosts, today, currentUserId],
  )

  const breakdown = useMemo(
    () => breakdownUid ? computeBeastBreakdown(breakdownUid, allGoals, allCompletions, allPosts, today) : null,
    [breakdownUid, allGoals, allCompletions, allPosts, today],
  )

  function prev() {
    setIdx(i => (i - 1 + carouselMetrics.length) % carouselMetrics.length)
  }
  function next() {
    setIdx(i => (i + 1) % carouselMetrics.length)
  }

  return (
    <>
      <BeastScoreCard
        metric={beastMetric}
        archive={archive}
        nameMap={nameMap}
        currentUserId={currentUserId}
        allGoals={allGoals}
        allCompletions={allCompletions}
        allPosts={allPosts}
        today={today}
        onShowInfo={() => setShowInfo(true)}
        onShowBreakdown={uid => setBreakdownUid(uid)}
      />

      <div className="rounded-2xl overflow-hidden bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 mb-6 shadow-sm">

        {/* Gradient header */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-400 dark:from-orange-900 dark:to-amber-800 px-5 pt-5 pb-4">
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
            {carouselMetrics.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className="rounded-full bg-white transition-all"
                style={{ width: i === idx ? 16 : 6, height: 6, opacity: i === idx ? 1 : 0.4 }}
              />
            ))}
          </div>
        </div>

        <RankGroupList
          key={metric.id}
          entries={metric.entries}
          myEntry={metric.myEntry}
          maxScore={metric.maxScore}
          nameMap={nameMap}
          currentUserId={currentUserId}
          clickable={entry => entry.uid !== currentUserId}
          onPersonClick={onMemberClick}
        />
      </div>

      {/* Beast Score info modal */}
      {showInfo && (
        <div
          className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-end sm:items-center justify-center z-50 p-4"
          onClick={() => setShowInfo(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-orange-500 to-amber-400 dark:from-orange-900 dark:to-amber-800 px-5 py-4 flex items-center justify-between">
              <p className="font-bold text-white text-base">How Beast Score Works</p>
              <button onClick={() => setShowInfo(false)} className="text-white/70 hover:text-white transition">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Base</p>
                {[
                  { pts: '+2 pts', label: 'per daily goal completed' },
                  { pts: '−1 pt',  label: 'per daily goal missed', neg: true },
                  { pts: '+3 pts', label: 'per "some days" completion (up to quota)' },
                  { pts: '−2 pts', label: 'per missed required session after week ends', neg: true },
                  { pts: '+2 pts', label: 'per day you post to the feed (max 1/day)' },
                ].map(({ pts, label, neg }) => (
                  <div key={label} className="flex items-start gap-3">
                    <span className={`text-sm font-bold w-16 shrink-0 ${neg ? 'text-red-400' : 'text-orange-500'}`}>{pts}</span>
                    <span className="text-sm text-gray-600 dark:text-gray-300">{label}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Bonuses</p>
                {[
                  { pts: '+5 pts',  label: 'each weekly goal quota met' },
                  { pts: '+10 pts', label: 'all daily goals done every day of the week' },
                  { pts: '+10 pts', label: 'all weekly goal quotas met' },
                  { pts: '+25 pts', label: 'BEAST WEEK — all dailies + all weeklies (awarded at week end)' },
                ].map(({ pts, label }) => (
                  <div key={label} className="flex items-start gap-3">
                    <span className="text-sm font-bold text-orange-500 w-16 shrink-0">{pts}</span>
                    <span className="text-sm text-gray-600 dark:text-gray-300">{label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-5 pb-5 space-y-2">
              <Link
                to="/scoring"
                onClick={() => setShowInfo(false)}
                className="w-full flex items-center justify-center gap-1.5 text-orange-500 hover:text-orange-400 text-sm font-medium py-1 transition"
              >
                Full scoring guide with examples
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
              <button
                onClick={() => setShowInfo(false)}
                className="w-full bg-orange-500 hover:bg-orange-400 text-white font-semibold rounded-xl py-2.5 text-sm transition"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Beast Score breakdown modal (current week, cumulative) */}
      {breakdownUid && breakdown && (
        <BeastBreakdownModal
          name={nameMap[breakdownUid] ?? 'Unknown'}
          breakdown={breakdown}
          onClose={() => setBreakdownUid(null)}
        />
      )}
    </>
  )
}

function PersonRow({ entry, name, isYou, maxScore, showRankBadge, isLast, clickable, onClick }: {
  entry: RankEntry
  name: string
  isYou: boolean
  maxScore: number
  showRankBadge: boolean
  isLast: boolean
  clickable: boolean
  onClick?: () => void
}) {
  const medal = MEDALS[entry.rank]
  const pct = maxScore > 0 ? (entry.score / maxScore) * 100 : 0

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3.5 px-5 py-3.5 text-left transition-colors ${
        isYou ? 'bg-orange-50 dark:bg-orange-950/20' : ''
      } ${clickable ? 'hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer' : 'cursor-default'} ${!isLast ? 'border-b border-gray-100 dark:border-gray-800' : ''}`}
    >
      {/* Rank badge, medal, or spacer */}
      {showRankBadge ? (
        medal ? (
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shrink-0 shadow-sm"
            style={{ background: medal.gradient, color: medal.text }}
          >
            {entry.rank}
          </div>
        ) : (
          <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
            {entry.rank}
          </div>
        )
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
            style={{ width: `${pct}%`, backgroundColor: medal?.bar ?? '#f97316' }}
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

function RankGroupList({ entries, myEntry, maxScore, nameMap, currentUserId, clickable, onPersonClick }: {
  entries: RankEntry[]
  myEntry?: RankEntry
  maxScore: number
  nameMap: Record<string, string>
  currentUserId?: string
  clickable: (entry: RankEntry) => boolean
  onPersonClick: (uid: string) => void
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  function toggleGroup(rank: number) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(rank) ? next.delete(rank) : next.add(rank)
      return next
    })
  }

  const rankGroups = useMemo(() => {
    const map = new Map<number, RankEntry[]>()
    for (const entry of entries) {
      if (!map.has(entry.rank)) map.set(entry.rank, [])
      map.get(entry.rank)!.push(entry)
    }
    return [...map.entries()].map(([rank, groupEntries]) => ({ rank, entries: groupEntries }))
  }, [entries])

  function row(entry: RankEntry, showRankBadge: boolean, isLast: boolean) {
    const isYou = entry.uid === currentUserId
    const name = nameMap[entry.uid] ?? 'Unknown'
    return (
      <PersonRow
        key={entry.uid}
        entry={entry}
        name={name}
        isYou={isYou}
        maxScore={maxScore}
        showRankBadge={showRankBadge}
        isLast={isLast}
        clickable={clickable(entry)}
        onClick={() => onPersonClick(entry.uid)}
      />
    )
  }

  return (
    <div>
      {rankGroups.length === 0 ? (
        <p className="text-center text-gray-400 dark:text-gray-500 text-sm py-8">
          No activity yet.
        </p>
      ) : (
        rankGroups.map(({ rank, entries: groupEntries }, groupIdx) => {
          const isGroupExpanded = expanded.has(rank)
          const hidden = groupEntries.slice(1)
          const hasMore = hidden.length > 0
          const isLastGroup = groupIdx === rankGroups.length - 1 && !myEntry

          return (
            <div key={rank} className="border-b border-gray-100 dark:border-gray-800 last:border-b-0">
              {/* First person — always visible */}
              {row(groupEntries[0], true, !hasMore && isLastGroup)}

              {/* Expanded: remaining tied people */}
              {isGroupExpanded && hidden.map((entry, i) =>
                row(entry, false, i === hidden.length - 1 && isLastGroup)
              )}

              {/* Expand / collapse toggle */}
              {hasMore && (
                <button
                  onClick={() => toggleGroup(rank)}
                  className="w-full flex items-center gap-2 px-5 py-2.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
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

      {/* Current user's rank when they're outside the top 3 */}
      {myEntry && (
        <>
          <div className="flex items-center gap-4 px-5 py-2 border-t border-dashed border-gray-200 dark:border-gray-700">
            <div className="flex-1 h-px bg-transparent" />
            <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider whitespace-nowrap">your rank</span>
            <div className="flex-1 h-px bg-transparent" />
          </div>
          {row(myEntry, true, true)}
        </>
      )}
    </div>
  )
}

function BeastScoreCard({
  metric, archive, nameMap, currentUserId, allGoals, allCompletions, allPosts, today, onShowInfo, onShowBreakdown,
}: {
  metric: LeaderboardMetric
  archive: WeekArchiveEntry[]
  nameMap: Record<string, string>
  currentUserId?: string
  allGoals: Goal[]
  allCompletions: Completion[]
  allPosts: Post[]
  today: string
  onShowInfo: () => void
  onShowBreakdown: (uid: string) => void
}) {
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [archiveModalWeek, setArchiveModalWeek] = useState<number | null>(null)
  const [weekTarget, setWeekTarget] = useState<{ uid: string; weekIndex: number } | null>(null)

  const weekBreakdown = useMemo(
    () => weekTarget
      ? computeWeekOnlyBreakdown(weekTarget.uid, weekTarget.weekIndex, allGoals, allCompletions, allPosts, today)
      : null,
    [weekTarget, allGoals, allCompletions, allPosts, today],
  )

  const archiveWeek = archiveModalWeek !== null
    ? archive.find(w => w.weekIndex === archiveModalWeek) ?? null
    : null

  return (
    <div className="rounded-2xl overflow-hidden bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 mb-6 shadow-sm">
      {/* Gradient header */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-400 dark:from-orange-900 dark:to-amber-800 px-5 pt-5 pb-4 text-center">
        <p className="font-bold text-white text-base leading-tight">{metric.name}</p>
        <div className="flex flex-col items-center gap-0.5 mt-0.5">
          <button
            onClick={onShowInfo}
            className="inline-flex items-center gap-1 text-orange-100 text-xs hover:text-white transition"
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" />
              <path strokeLinecap="round" d="M12 16v-4M12 8h.01" />
            </svg>
            How points are calculated
          </button>
          <p className="text-orange-100/60 text-xs">Resets every week · tap a row for the breakdown</p>
        </div>
      </div>

      <RankGroupList
        entries={metric.entries}
        myEntry={metric.myEntry}
        maxScore={metric.maxScore}
        nameMap={nameMap}
        currentUserId={currentUserId}
        clickable={() => true}
        onPersonClick={onShowBreakdown}
      />

      {/* Trophy Shelf toggle */}
      {archive.length > 0 && (
        <div className="border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={() => setArchiveOpen(o => !o)}
            className="w-full flex items-center justify-between gap-2 px-5 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
          >
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 inline-flex items-center gap-1.5">
              <span>🏆</span> Trophy Shelf
            </span>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${archiveOpen ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {archiveOpen && (
            <div className="px-5 pb-4 flex gap-2.5 overflow-x-auto">
              {archive.map(week => (
                <button
                  key={week.weekIndex}
                  onClick={() => setArchiveModalWeek(week.weekIndex)}
                  className="shrink-0 flex flex-col items-center gap-1.5 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl px-3.5 py-3 transition-colors min-w-[110px]"
                >
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{week.label}</span>
                  <div className="flex items-center -space-x-2">
                    {week.entries.slice(0, 3).map(e => {
                      const medal = MEDALS[e.rank]
                      const name = nameMap[e.uid] ?? 'Unknown'
                      return (
                        <div
                          key={e.uid}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
                          style={{
                            backgroundColor: avatarColor(e.uid),
                            boxShadow: medal ? `0 0 0 2px ${medal.bar}` : '0 0 0 2px white',
                          }}
                          title={name}
                        >
                          {getInitials(name)}
                        </div>
                      )
                    })}
                  </div>
                  {week.myEntry && (
                    <span className="text-[11px] font-medium text-orange-500 dark:text-orange-400">
                      You: #{week.myEntry.rank}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Week archive modal */}
      {archiveWeek && (
        <WeekArchiveModal
          week={archiveWeek}
          nameMap={nameMap}
          currentUserId={currentUserId}
          onClose={() => setArchiveModalWeek(null)}
          onPersonClick={uid => {
            setWeekTarget({ uid, weekIndex: archiveWeek.weekIndex })
            setArchiveModalWeek(null)
          }}
        />
      )}

      {/* Single-week breakdown modal */}
      {weekTarget && weekBreakdown && (
        <WeekOnlyBreakdownModal
          name={nameMap[weekTarget.uid] ?? 'Unknown'}
          breakdown={weekBreakdown}
          onClose={() => setWeekTarget(null)}
        />
      )}
    </div>
  )
}

function WeekArchiveModal({ week, nameMap, currentUserId, onClose, onPersonClick }: {
  week: WeekArchiveEntry
  nameMap: Record<string, string>
  currentUserId?: string
  onClose: () => void
  onPersonClick: (uid: string) => void
}) {
  const maxScore = week.entries[0]?.score ?? 0
  return (
    <div
      className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-end sm:items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-orange-500 to-amber-400 dark:from-orange-900 dark:to-amber-800 px-5 py-4 flex items-center justify-between shrink-0">
          <div>
            <p className="font-bold text-white text-base">🏆 {week.label}</p>
            <p className="text-orange-100/60 text-xs">Tap a contestant for that week's breakdown</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          <RankGroupList
            entries={week.entries}
            myEntry={week.myEntry}
            maxScore={maxScore}
            nameMap={nameMap}
            currentUserId={currentUserId}
            clickable={() => true}
            onPersonClick={onPersonClick}
          />
        </div>
      </div>
    </div>
  )
}

function WeekOnlyBreakdownModal({ name, breakdown, onClose }: {
  name: string
  breakdown: WeekOnlyBreakdown
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-end sm:items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-400 dark:from-orange-900 dark:to-amber-800 px-5 py-4 flex items-center justify-between shrink-0">
          <div>
            <p className="font-bold text-white text-base">{name}'s {breakdown.label}</p>
            <p className="text-orange-100 text-sm font-semibold">{breakdown.total} pts that week</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {breakdown.lines.length === 0 ? (
            <p className="text-center text-gray-400 dark:text-gray-500 text-sm py-6">No goals that week.</p>
          ) : (
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 space-y-2">
              {breakdown.lines.map((line, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 ${line.isBonus ? 'pt-2 mt-1 border-t border-gray-200 dark:border-gray-700' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${line.isBonus ? 'text-orange-500 dark:text-orange-400' : 'text-gray-800 dark:text-gray-100'}`}>
                      {line.label}
                    </p>
                    {line.parts && line.parts.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {line.parts.map((chip, j) => (
                          <Chip key={j} chip={chip} />
                        ))}
                      </div>
                    )}
                  </div>
                  <span className={`text-sm font-bold shrink-0 tabular-nums ${
                    line.pts > 0
                      ? line.isBonus ? 'text-orange-500 dark:text-orange-400' : 'text-green-500 dark:text-green-400'
                      : 'text-red-400'
                  }`}>
                    {line.pts > 0 ? `+${line.pts}` : line.pts}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Feed posts */}
          {breakdown.postDays > 0 && (
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">Feed posts</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {breakdown.postDays} day{breakdown.postDays !== 1 ? 's' : ''} × +2
                </p>
              </div>
              <span className="text-sm font-bold text-green-500 dark:text-green-400 tabular-nums">
                +{breakdown.postPts}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function BeastBreakdownModal({ name, breakdown, onClose }: {
  name: string
  breakdown: BeastBreakdown
  onClose: () => void
}) {
  const currentWeek = breakdown.weeks[breakdown.weeks.length - 1] ?? null

  return (
    <div
      className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-end sm:items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-400 dark:from-orange-900 dark:to-amber-800 px-5 py-4 flex items-center justify-between shrink-0">
          <div>
            <p className="font-bold text-white text-base">{name}'s Beast Score</p>
            <p className="text-orange-100 text-sm font-semibold">{breakdown.currentWeekScore} pts this week</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {!currentWeek ? (
            <p className="text-center text-gray-400 dark:text-gray-500 text-sm py-6">No goals set up yet.</p>
          ) : (
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
              {currentWeek.lines.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-500">No goals this week</p>
              ) : (
                <div className="space-y-2">
                  {currentWeek.lines.map((line, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-2 ${line.isBonus ? 'pt-2 mt-1 border-t border-gray-200 dark:border-gray-700' : ''}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${line.isBonus ? 'text-orange-500 dark:text-orange-400' : 'text-gray-800 dark:text-gray-100'}`}>
                          {line.label}
                        </p>
                        {line.parts && line.parts.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {line.parts.map((chip, j) => (
                              <Chip key={j} chip={chip} />
                            ))}
                          </div>
                        )}
                      </div>
                      <span className={`text-sm font-bold shrink-0 tabular-nums ${
                        line.pts > 0
                          ? line.isBonus ? 'text-orange-500 dark:text-orange-400' : 'text-green-500 dark:text-green-400'
                          : 'text-red-400'
                      }`}>
                        {line.pts > 0 ? `+${line.pts}` : line.pts}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Feed posts (current week only) */}
          {breakdown.currentWeekPostDays > 0 && (
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">Feed posts</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {breakdown.currentWeekPostDays} day{breakdown.currentWeekPostDays !== 1 ? 's' : ''} × +2
                </p>
              </div>
              <span className="text-sm font-bold text-green-500 dark:text-green-400 tabular-nums">
                +{breakdown.currentWeekPostPts}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Chip({ chip }: { chip: BreakdownChip }) {
  const styles = {
    green:  'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400',
    red:    'bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400',
    orange: 'bg-orange-50 text-orange-500 dark:bg-orange-900/20 dark:text-orange-400',
    gray:   'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
  }
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${styles[chip.color]}`}>
      {chip.text}
    </span>
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
