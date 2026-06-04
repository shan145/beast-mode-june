import { useState, useEffect, useRef } from 'react'
import type { Reaction, UserProfile } from '@/types'
import { subscribeToReactions, toggleReaction } from '@/lib/firestore'
import { sendNotification } from '@/lib/pushNotifications'
import { auth } from '@/lib/firebase'

interface Props {
  postId: string
  postAuthorId: string
  currentUserId: string
  userMap: Record<string, UserProfile>
}

const QUICK_EMOJIS = ['👍', '❤️', '🔥', '🎉', '😂', '💀']

export default function ReactionBar({ postId, postAuthorId, currentUserId, userMap }: Props) {
  const [reactions, setReactions] = useState<Reaction[]>([])
  const [open, setOpen] = useState(false)
  const trayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return subscribeToReactions(postId, setReactions)
  }, [postId])

  // Close tray on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: Event) {
      if (trayRef.current && !trayRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('touchstart', handleClick)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('touchstart', handleClick)
    }
  }, [open])

  const [hoveredEmoji, setHoveredEmoji] = useState<string | null>(null)
  const [tooltipAnchor, setTooltipAnchor] = useState<{ x: number; y: number } | null>(null)

  // Long-press / bottom-sheet state for mobile
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPress = useRef(false)
  const [sheetEmoji, setSheetEmoji] = useState<string | null>(null)

  function startLongPress(emoji: string) {
    didLongPress.current = false
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true
      setSheetEmoji(emoji)
    }, 400)
  }

  function cancelLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  const groups = reactions.reduce<Record<string, { count: number; isMine: boolean; uids: string[] }>>((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = { count: 0, isMine: false, uids: [] }
    acc[r.emoji].count++
    acc[r.emoji].uids.push(r.userId)
    if (r.userId === currentUserId) acc[r.emoji].isMine = true
    return acc
  }, {})

  async function pick(emoji: string) {
    const wasReacted = groups[emoji]?.isMine ?? false
    await toggleReaction(currentUserId, postId, emoji)
    setOpen(false)
    // Only notify on add, not on remove; don't notify if reacting to own post
    if (!wasReacted && postAuthorId !== currentUserId) {
      const name = auth.currentUser?.displayName ?? 'Someone'
      sendNotification('feed-reaction', { userName: name, postId, emoji }, { recipientIds: [postAuthorId] })
    }
  }

  return (
    <div className="px-4 pb-2 flex flex-wrap items-center gap-1.5 relative">
      <div ref={trayRef} className="relative">
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center justify-center w-8 h-8 rounded-full border border-dashed border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition text-base leading-none"
        >
          😀
        </button>

        {open && (
          <div className="absolute bottom-full mb-2 left-0 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-2 z-30">
            <div className="flex gap-1">
              {QUICK_EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => pick(emoji)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl text-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition active:scale-90"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {Object.entries(groups).map(([emoji, { count, isMine }]) => (
        <button
          key={emoji}
          onClick={() => {
            if (didLongPress.current) { didLongPress.current = false; return }
            toggleReaction(currentUserId, postId, emoji)
          }}
          onPointerEnter={e => {
            if (e.pointerType !== 'mouse') return
            const rect = e.currentTarget.getBoundingClientRect()
            setHoveredEmoji(emoji)
            setTooltipAnchor({ x: rect.left + rect.width / 2, y: rect.top })
          }}
          onPointerLeave={e => {
            if (e.pointerType !== 'mouse') return
            setHoveredEmoji(null)
            setTooltipAnchor(null)
          }}
          onTouchStart={() => startLongPress(emoji)}
          onTouchEnd={cancelLongPress}
          onTouchMove={cancelLongPress}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-sm border transition select-none
            ${isMine
              ? 'bg-orange-50 dark:bg-orange-950 border-orange-300 dark:border-orange-700'
              : 'bg-gray-100 dark:bg-gray-800 border-transparent hover:border-gray-300 dark:hover:border-gray-600'
            }`}
        >
          <span>{emoji}</span>
          <span className={`text-xs font-medium ${isMine ? 'text-orange-600 dark:text-orange-400' : 'text-gray-600 dark:text-gray-400'}`}>
            {count}
          </span>
        </button>
      ))}

      {/* Mobile long-press bottom sheet */}
      {sheetEmoji && groups[sheetEmoji] && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setSheetEmoji(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl pb-safe">
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
            </div>
            <div className="px-5 pb-2 pt-1">
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">{sheetEmoji} Reacted</p>
              <ul className="space-y-3">
                {groups[sheetEmoji].uids.map(uid => (
                  <li key={uid} className="text-sm font-medium text-gray-900 dark:text-white">
                    {uid === currentUserId ? 'You' : (userMap[uid]?.displayName || 'Someone')}
                  </li>
                ))}
              </ul>
            </div>
            <div className="h-6" />
          </div>
        </>
      )}

      {/* Fixed-position tooltip — escapes overflow:hidden on PostCard */}
      {hoveredEmoji && tooltipAnchor && groups[hoveredEmoji] && (
        <div
          className="pointer-events-none z-50"
          style={{ position: 'fixed', left: tooltipAnchor.x, top: tooltipAnchor.y - 8, transform: 'translate(-50%, -100%)' }}
        >
          <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg px-2.5 py-1.5 shadow-lg max-w-[200px] text-center leading-relaxed">
            {groups[hoveredEmoji].uids.map(uid =>
              uid === currentUserId ? 'You' : (userMap[uid]?.displayName || 'Someone')
            ).join(', ')}
          </div>
          <div className="flex justify-center">
            <div className="border-4 border-transparent border-t-gray-900 dark:border-t-gray-700" />
          </div>
        </div>
      )}
    </div>
  )
}
