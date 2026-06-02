import type { UserProfile } from '@/types'

interface Props {
  member: UserProfile
  isYou?: boolean
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

export default function MemberCard({ member, isYou, onClick }: Props) {
  const color = avatarColor(member.uid)
  const abbr = initials(member.displayName || member.email)

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl px-4 py-3 transition-colors text-left border border-gray-100 dark:border-transparent"
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
      <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}
