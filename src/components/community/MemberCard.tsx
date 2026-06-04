import { useState } from 'react'
import type { UserProfile } from '@/types'
import { sendNotification } from '@/lib/pushNotifications'
import { auth } from '@/lib/firebase'

interface Props {
  member: UserProfile
  isYou?: boolean
  allDailyDoneToday?: boolean
  anyCompletionToday?: boolean
  currentUserName?: string
  onClick: () => void
}

const AVATAR_COLORS = [
  '#f97316', '#3b82f6', '#a855f7', '#10b981', '#ef4444', '#f59e0b', '#06b6d4',
]

function avatarColor(uid: string): string {
  const hash = uid.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function initials(name: string): string {
  return name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function MemberCard({ member, isYou, allDailyDoneToday, anyCompletionToday, currentUserName, onClick }: Props) {
  const color = avatarColor(member.uid)
  const abbr = initials(member.displayName || member.email)
  const [sent, setSent] = useState(false)
  const [celebSent, setCelebSent] = useState(false)

  async function handleBeast(e: React.MouseEvent) {
    e.stopPropagation()
    const currentUser = auth.currentUser
    if (!currentUser) return
    setSent(true)
    const fromName = currentUserName ?? currentUser.displayName ?? 'Someone'
    const toName = member.displayName || member.email || 'Someone'
    sendNotification('gift-sent', { userName: fromName, toName, toUserId: member.uid }, { recipientIds: [member.uid] })
    setTimeout(() => setSent(false), 1500)
  }

  async function handleCelebration(e: React.MouseEvent) {
    e.stopPropagation()
    const currentUser = auth.currentUser
    if (!currentUser) return
    setCelebSent(true)
    const fromName = currentUserName ?? currentUser.displayName ?? 'Someone'
    const toName = member.displayName || member.email || 'Someone'
    sendNotification('celebration-sent', { userName: fromName, toName, toUserId: member.uid }, { recipientIds: [member.uid] })
    setTimeout(() => setCelebSent(false), 1500)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
      className="w-full flex items-center gap-3 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl px-4 py-3 transition-colors text-left border border-gray-100 dark:border-transparent cursor-pointer"
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
        style={{ backgroundColor: color }}
      >
        {abbr}
      </div>
      <span className="flex-1 text-gray-900 dark:text-white font-medium text-sm">
        {member.displayName || member.email}
      </span>
      {isYou && (
        <span className="text-xs text-gray-400 dark:text-gray-500 font-normal mr-1">You</span>
      )}
      {!isYou && allDailyDoneToday && (
        <button
          onClick={handleBeast}
          disabled={sent}
          className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full transition mr-1
            ${sent
              ? 'bg-orange-100 dark:bg-orange-950 text-orange-400 dark:text-orange-500 cursor-default'
              : 'bg-orange-500 hover:bg-orange-400 text-white'
            }`}
        >
          {sent ? 'Sent!' : 'Send Beast Kudos'}
        </button>
      )}
      {!isYou && !allDailyDoneToday && anyCompletionToday && (
        <button
          onClick={handleCelebration}
          disabled={celebSent}
          className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full transition mr-1
            ${celebSent
              ? 'bg-sky-100 dark:bg-sky-950 text-sky-400 dark:text-sky-500 cursor-default'
              : 'bg-sky-500 hover:bg-sky-400 text-white'
            }`}
        >
          {celebSent ? 'Sent!' : 'Send Celebration'}
        </button>
      )}
      <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </div>
  )
}
