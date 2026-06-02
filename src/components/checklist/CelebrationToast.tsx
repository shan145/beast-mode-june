import { useEffect, useState } from 'react'

interface Props {
  type: 'daily' | 'weekly' | 'weekly-log'
  onDismiss: () => void
}

const DAILY_MESSAGES = [
  "You showed up today — that's everything.",
  "Daily goals done. Rest easy tonight.",
  "Consistency is the whole game. You're winning.",
  "Another day, another W.",
  "Small actions, compounded. That's the recipe.",
  "Not every day is easy. Today happened anyway.",
  "Done for the day. That's all it takes."
]

const WEEKLY_LOG_MESSAGES = [
  "Weekly goal logged. Keep stacking.",
  "One more for the week.",
  "That's one. Keep going.",
  "Weekly progress noted.",
  "Logged. Don't stop there.",
  "Building the habit, one rep at a time.",
]

const WEEKLY_MESSAGES = [
  "That's a full week of showing up. Incredible.",
  "Weekly quota crushed. You earned the weekend.",
  "The whole week? Done. You're built different.",
  "Seven days of effort. One week of progress.",
  "A full week. No excuses, no skipped days.",
  "This week's version of you > last week's.",
  "Weeks like this are how it gets done.",
  "Stack enough weeks like this and watch what happens.",
]

function randomPick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)]
}

export default function CelebrationToast({ type, onDismiss }: Props) {
  const isWeekly = type === 'weekly'
  const isWeeklyLog = type === 'weekly-log'
  const [visible, setVisible] = useState(false)
  const message = isWeekly
    ? randomPick(WEEKLY_MESSAGES)
    : isWeeklyLog
      ? randomPick(WEEKLY_LOG_MESSAGES)
      : randomPick(DAILY_MESSAGES)
  const duration = isWeekly ? 4500 : isWeeklyLog ? 2000 : 3500

  useEffect(() => {
    // Trigger enter animation on next tick
    requestAnimationFrame(() => setVisible(true))

    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onDismiss, 350)
    }, duration)

    return () => clearTimeout(timer)
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      onClick={() => { setVisible(false); setTimeout(onDismiss, 350) }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
      />

      {/* Card */}
      <div
        className={`relative w-full max-w-xs rounded-3xl p-8 text-center shadow-2xl transition-all duration-300 ${
          isWeekly
            ? 'bg-gradient-to-br from-emerald-500 to-teal-600'
            : isWeeklyLog
              ? 'bg-gradient-to-br from-blue-500 to-indigo-600'
              : 'bg-gradient-to-br from-orange-500 to-amber-500'
        }`}
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'scale(1) translateY(0)' : 'scale(0.85) translateY(16px)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Icon */}
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
          isWeekly ? 'bg-white/20' : 'bg-white/20'
        }`}>
          {isWeekly ? <TrophyIcon /> : isWeeklyLog ? <PlusIcon /> : <CheckAllIcon />}
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-white mb-2">
          {isWeekly ? 'Weekly Goals Done!' : isWeeklyLog ? 'Weekly Goal Logged!' : 'Daily Goals Done!'}
        </h2>

        {/* Message */}
        <p className="text-white/80 text-sm leading-relaxed">{message}</p>

        {/* Timer bar */}
        <div className="mt-5 h-1 bg-white/25 rounded-full overflow-hidden">
          <div
            className="h-full bg-white/60 rounded-full"
            style={{ animation: `shrinkWidth ${duration}ms linear forwards` }}
          />
        </div>
      </div>
    </div>
  )
}

function CheckAllIcon() {
  return (
    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  )
}

function TrophyIcon() {
  return (
    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15c-3.314 0-6-2.686-6-6V4h12v5c0 3.314-2.686 6-6 6z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 4H4a2 2 0 00-2 2v1a4 4 0 004 4M18 4h2a2 2 0 012 2v1a4 4 0 01-4 4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v4M8 21h8" />
    </svg>
  )
}
