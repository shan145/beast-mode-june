import { useState, useRef } from 'react'
import type { Timestamp } from 'firebase/firestore'
import type { Post, UserProfile } from '@/types'

interface Props {
  post: Post
  author: UserProfile | undefined
  isOwn: boolean
  onEdit: () => void
  onDelete: () => void
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

function timeAgo(ts: Timestamp | null): string {
  if (!ts) return 'just now'
  const diff = Date.now() - ts.toMillis()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return ts.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function PostCard({ post, author, isOwn, onEdit, onDelete }: Props) {
  const [imgIdx, setImgIdx] = useState(0)
  const touchStartX = useRef<number>(0)
  const name = author?.displayName || author?.email || 'Unknown'
  const color = avatarColor(post.userId)
  const abbr = initials(name)
  const urls = post.imageURLs ?? []

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const delta = touchStartX.current - e.changedTouches[0].clientX
    if (delta > 50 && imgIdx < urls.length - 1) setImgIdx(i => i + 1)
    if (delta < -50 && imgIdx > 0) setImgIdx(i => i - 1)
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden border border-gray-100 dark:border-transparent shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
          style={{ backgroundColor: color }}
        >
          {abbr}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{name}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">{timeAgo(post.createdAt)}</p>
        </div>
        {isOwn && (
          <div className="flex gap-1">
            <button
              onClick={onEdit}
              className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              Edit
            </button>
            <button
              onClick={onDelete}
              className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Image carousel */}
      {urls.length > 0 && (
        <div
          className="relative bg-black"
          style={{ aspectRatio: '1/1', touchAction: 'pan-y' }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <img
            src={urls[imgIdx]}
            alt=""
            className="w-full h-full object-contain"
          />

          {urls.length > 1 && (
            <>
              {/* Counter — visible on all screen sizes */}
              <div className="absolute top-2 right-2 bg-black/50 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                {imgIdx + 1}/{urls.length}
              </div>

              {/* Arrows — desktop only */}
              {imgIdx > 0 && (
                <button
                  onClick={() => setImgIdx(i => i - 1)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white hidden md:flex items-center justify-center transition"
                >
                  ‹
                </button>
              )}
              {imgIdx < urls.length - 1 && (
                <button
                  onClick={() => setImgIdx(i => i + 1)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white hidden md:flex items-center justify-center transition"
                >
                  ›
                </button>
              )}

              {/* Dots — visible on all screen sizes */}
              <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
                {urls.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setImgIdx(i)}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${i === imgIdx ? 'bg-white' : 'bg-white/40'}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Caption */}
      {post.caption && (
        <div className="px-4 py-3">
          <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">{post.caption}</p>
        </div>
      )}
    </div>
  )
}
