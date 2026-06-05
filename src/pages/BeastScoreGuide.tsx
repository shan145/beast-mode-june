import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

// ── Primitive helpers ─────────────────────────────────────────────────────────

function Pt({ n }: { n: number }) {
  const pos = n >= 0
  return (
    <span className={`inline-block font-bold tabular-nums ${pos ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
      {pos ? `+${n}` : n}
    </span>
  )
}

function Badge({ children, color }: { children: ReactNode; color: 'green' | 'red' | 'orange' | 'gray' }) {
  const styles = {
    green:  'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    red:    'bg-red-50 text-red-500 dark:bg-red-900/30 dark:text-red-400',
    orange: 'bg-orange-50 text-orange-500 dark:bg-orange-900/30 dark:text-orange-400',
    gray:   'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
  }
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${styles[color]}`}>
      {children}
    </span>
  )
}

function RuleRow({ pts, label, neg }: { pts: string; label: string; neg?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-gray-700/60 last:border-0">
      <span className={`text-sm font-bold w-20 shrink-0 tabular-nums ${neg ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
        {pts}
      </span>
      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
    </div>
  )
}

function ScoreRow({ label, sub, pts, highlight }: { label: string; sub?: string; pts: number; highlight?: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${highlight ? 'bg-orange-50 dark:bg-orange-900/20' : 'bg-gray-50 dark:bg-gray-800/60'}`}>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${highlight ? 'text-orange-600 dark:text-orange-400' : 'text-gray-800 dark:text-gray-100'}`}>{label}</p>
        {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
      </div>
      <Pt n={pts} />
    </div>
  )
}

function WeekCard({ title, rows, total }: {
  title: string
  rows: { label: string; sub?: string; pts: number; highlight?: boolean }[]
  total: number
}) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-100 dark:bg-gray-700/50">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{title}</span>
        <span className={`text-sm font-bold tabular-nums ${total >= 0 ? 'text-gray-700 dark:text-gray-200' : 'text-red-500'}`}>
          {total >= 0 ? `+${total}` : total} pts
        </span>
      </div>
      <div className="px-4 py-3 space-y-1.5">
        {rows.map((r, i) => <ScoreRow key={i} {...r} />)}
      </div>
    </div>
  )
}

// ── Q&A data ──────────────────────────────────────────────────────────────────
// To add a new entry, append an object to this array.
// `a` accepts any JSX so you can use tables, badges, WeekCard, etc.

interface QA { id: string; q: string; a: ReactNode }

const QAS: QA[] = [
  {
    id: 'what-is-beast-score',
    q: 'What is the Beast Score?',
    a: (
      <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        <p>
          The Beast Score is a <strong>weekly</strong> scoring system that measures how consistently you
          stick to your commitments. Points are calculated week-by-week (Sun–Sat), then summed across
          all of June.
        </p>
        <p>
          Unlike simply counting completions, the Beast Score <strong>rewards consistency</strong> and
          <strong> penalizes skipping</strong>, so someone who does fewer goals flawlessly can outscore
          someone who takes on a lot but follows through poorly.
        </p>
        <p>
          Every week has four ways to earn points: base completions, per-goal quota bonuses, a perfect
          daily week bonus, an all-weeklies-met bonus, and the ultimate BEAST WEEK bonus.
        </p>
      </div>
    ),
  },
  {
    id: 'daily-goals',
    q: 'How are daily goals scored?',
    a: (
      <div className="space-y-4">
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          Each daily goal is tracked every day of the week. Completing it earns points; missing it costs
          points.
        </p>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <RuleRow pts="+2 pts" label="per daily goal completed" />
          <RuleRow pts="−1 pt"  label="per daily goal missed" neg />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Example — Morning Run goal, one week</p>
        <div className="grid grid-cols-3 text-sm rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
          {['Day', 'Status', 'Pts'].map(h => (
            <div key={h} className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800">{h}</div>
          ))}
          {[
            ['Mon', '✓ done',   2],
            ['Tue', '✓ done',   2],
            ['Wed', '✗ missed', -1],
            ['Thu', '✓ done',   2],
            ['Fri', '✓ done',   2],
            ['Sat', '✗ missed', -1],
            ['Sun', '✓ done',   2],
          ].map(([day, status, pts]) => (
            <>
              <div key={day + 'a'} className="px-3 py-2 text-gray-700 dark:text-gray-300 border-t border-gray-100 dark:border-gray-700">{day}</div>
              <div key={day + 'b'} className={`px-3 py-2 border-t border-gray-100 dark:border-gray-700 ${(pts as number) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>{status}</div>
              <div key={day + 'c'} className="px-3 py-2 border-t border-gray-100 dark:border-gray-700"><Pt n={pts as number} /></div>
            </>
          ))}
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">Total</div>
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">5 of 7 days</div>
          <div className="px-3 py-2 font-bold bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700"><Pt n={8} /></div>
        </div>
      </div>
    ),
  },
  {
    id: 'weekly-goals',
    q: 'How are "some days" (weekly) goals scored?',
    a: (
      <div className="space-y-4">
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          Weekly goals have a quota — e.g. "go to the gym 3 times this week." You earn points for
          each session, a bonus for hitting your quota, and a penalty for falling short once the week is over.
        </p>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <RuleRow pts="+3 pts" label="per session completed (up to quota)" />
          <RuleRow pts="+5 pts" label="bonus when quota is fully met" />
          <RuleRow pts="−2 pts" label="per missed required session (charged at week end)" neg />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Example — Gym goal, quota: 3×/week</p>
        <div className="space-y-2">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/40">
            <Badge color="green">3/3 done</Badge>
            <div className="flex-1 text-sm text-gray-700 dark:text-gray-300">3 × <Pt n={3} /> + <Badge color="orange">quota bonus</Badge> <Pt n={5} /></div>
            <span className="font-bold text-green-600 dark:text-green-400">= +14 pts</span>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/40">
            <Badge color="orange">2/3 done</Badge>
            <div className="flex-1 text-sm text-gray-700 dark:text-gray-300">2 × <Pt n={3} /> = +6, no bonus, week still open</div>
            <span className="font-bold text-orange-500">= +6 pts</span>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/40">
            <Badge color="red">1/3 done</Badge>
            <div className="flex-1 text-sm text-gray-700 dark:text-gray-300">1 × <Pt n={3} /> + 2 missed × <Pt n={-2} /></div>
            <span className="font-bold text-red-500">= −1 pt</span>
          </div>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Penalties are only applied once the week is fully over (Sunday night). During an active week you only earn — never lose.
        </p>
      </div>
    ),
  },
  {
    id: 'bonuses',
    q: 'What weekly bonuses can I earn?',
    a: (
      <div className="space-y-4">
        <div className="space-y-3">
          {[
            {
              title: 'Perfect Daily Week',
              pts: '+10 pts',
              color: 'green' as const,
              desc: 'All of your daily goals completed every single day of the week. Awarded at week end.',
            },
            {
              title: 'All Weekly Goals Met',
              pts: '+10 pts',
              color: 'orange' as const,
              desc: 'Every weekly goal hit its quota. Awarded as soon as all quotas are reached.',
            },
            {
              title: 'BEAST WEEK',
              pts: '+25 pts',
              color: 'orange' as const,
              desc: 'Perfect Daily Week AND All Weekly Goals Met in the same week. Requires having both goal types. Awarded at week end.',
            },
          ].map(({ title, pts, color, desc }) => (
            <div key={title} className="flex gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
              <div className="shrink-0 text-right w-16">
                <span className={`text-sm font-bold tabular-nums ${color === 'green' ? 'text-green-600 dark:text-green-400' : 'text-orange-500 dark:text-orange-400'}`}>{pts}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-white">{title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          BEAST WEEK is a bonus <em>on top of</em> the other two — so a perfect beast week adds
          +10 + +10 + +25 = <strong className="text-gray-700 dark:text-gray-300">+45 pts in bonuses alone</strong>.
        </p>
      </div>
    ),
  },
  {
    id: 'full-example',
    q: 'Can I see a full week example?',
    a: (
      <div className="space-y-4">
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          Alex has 2 daily goals (Morning Run, Journaling) and 1 weekly goal (Gym, 3×/week).
          Here's how a solid-but-not-perfect week breaks down:
        </p>
        <WeekCard
          title="Jun 1–7"
          total={49}
          rows={[
            { label: 'Morning Run', sub: '6 done · 1 missed  →  6×+2, 1×−1', pts: 11 },
            { label: 'Journaling',  sub: '7 done · 0 missed  →  7×+2',       pts: 14 },
            { label: 'Gym (3×/wk)', sub: '3/3 done  →  3×+3, +5 quota bonus', pts: 14 },
            { label: 'All weekly goals met',  pts: 10, highlight: true },
          ]}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400">
          No BEAST WEEK because Morning Run was missed once — the perfect daily week bonus wasn't earned.
          One more day of consistency would have added +10 (perfect daily) + +25 (beast week) = <strong>+35 extra</strong>.
        </p>

        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 pt-2">Now compare to a true BEAST WEEK:</p>
        <WeekCard
          title="Jun 1–7 — Beast Week"
          total={84}
          rows={[
            { label: 'Morning Run', sub: '7 done  →  7×+2', pts: 14 },
            { label: 'Journaling',  sub: '7 done  →  7×+2', pts: 14 },
            { label: 'Gym (3×/wk)', sub: '3/3 done  →  3×+3, +5 quota bonus', pts: 14 },
            { label: 'Perfect daily week',    pts: 10, highlight: true },
            { label: 'All weekly goals met',  pts: 10, highlight: true },
            { label: 'BEAST WEEK',            pts: 25, highlight: true },
          ]}
        />
      </div>
    ),
  },
  {
    id: 'risk-reward',
    q: 'Why does having more goals carry more risk?',
    a: (
      <div className="space-y-4">
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          More goals means more points if you follow through — but miss them and you take a bigger hit.
          The penalty system ensures you can't just add a bunch of goals, ignore most of them, and still win.
        </p>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Daily goals missed all week</p>
        <div className="space-y-2">
          {[
            { goals: 1, label: '1 daily goal, 0/7 days', pts: -7 },
            { goals: 3, label: '3 daily goals, 0/7 days each', pts: -21 },
            { goals: 5, label: '5 daily goals, 0/7 days each', pts: -35 },
          ].map(({ label, pts }) => (
            <div key={label} className="flex items-center justify-between px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30">
              <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
              <Pt n={pts} />
            </div>
          ))}
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          On the flip side, someone with 5 goals who does them perfectly earns far more than someone
          with 1. The system rewards the ambitious — as long as they actually show up.
        </p>
      </div>
    ),
  },
  {
    id: 'feed-posts',
    q: 'How do feed posts factor in?',
    a: (
      <div className="space-y-3">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <RuleRow pts="+2 pts" label="per unique day you post to the feed (max 1 credit per day)" />
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          Posting multiple times on the same day still counts as 1 day. 30 post days over June = +60 pts.
          There's no penalty for not posting.
        </p>
      </div>
    ),
  },
  {
    id: 'partial-week',
    q: 'What about the current (in-progress) week?',
    a: (
      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        During an active week, daily miss penalties and weekly goal shortfall penalties are <strong>not</strong> applied yet —
        you still have time to make them up. Completions earn points in real time. End-of-week bonuses
        (Perfect Daily Week, BEAST WEEK) are only awarded once Saturday has passed.
        Weekly quota bonuses (+5 per goal) are awarded as soon as you hit the quota mid-week, since
        completions are permanent.
      </p>
    ),
  },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BeastScoreGuide() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-400 dark:from-orange-900 dark:to-amber-800 px-5 pt-10 pb-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-orange-200/80 hover:text-white text-sm mb-4 transition"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <p className="text-orange-200/80 text-xs font-semibold uppercase tracking-widest mb-1">Beast Mode June</p>
        <h1 className="text-2xl font-black text-white mb-1">Beast Score Guide</h1>
        <p className="text-orange-100/80 text-sm">How points are earned, lost, and multiplied.</p>
      </div>

      {/* Q&A list */}
      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {QAS.map(({ id, q, a }) => (
          <div
            key={id}
            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm"
          >
            <div className="px-5 pt-5 pb-3 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-base font-bold text-gray-900 dark:text-white leading-snug">{q}</h2>
            </div>
            <div className="px-5 py-4">{a}</div>
          </div>
        ))}

        <p className="text-center text-xs text-gray-400 dark:text-gray-600 pb-6">
          Beast Mode June · June 2026
        </p>
      </div>
    </div>
  )
}
