import { useState, useEffect, useRef } from 'react'
import type { Reaction } from '@/types'
import { subscribeToReactions, toggleReaction } from '@/lib/firestore'

interface Props {
  postId: string
  currentUserId: string
}

const QUICK_EMOJIS = ['👍', '❤️', '🔥', '🎉', '😂', '💀']

export default function ReactionBar({ postId, currentUserId }: Props) {
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

  const groups = reactions.reduce<Record<string, { count: number; isMine: boolean }>>((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = { count: 0, isMine: false }
    acc[r.emoji].count++
    if (r.userId === currentUserId) acc[r.emoji].isMine = true
    return acc
  }, {})

  function pick(emoji: string) {
    toggleReaction(currentUserId, postId, emoji)
    setOpen(false)
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
          onClick={() => toggleReaction(currentUserId, postId, emoji)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-sm border transition
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
    </div>
  )
}
