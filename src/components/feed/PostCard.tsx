import { useState, useRef, useEffect } from 'react'
import type { Timestamp } from 'firebase/firestore'
import type { Post, UserProfile } from '@/types'
import { toWorkerUrl } from '@/lib/images'
import CommentSection from './CommentSection'
import ReactionBar from './ReactionBar'

interface Props {
  post: Post
  author: UserProfile | undefined
  isOwn: boolean
  currentUserId: string
  userMap: Record<string, UserProfile>
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

export default function PostCard({ post, author, isOwn, currentUserId, userMap, onEdit, onDelete }: Props) {
  const [imgIdx, setImgIdx] = useState(0)
  const [dragOffset, setDragOffset] = useState(0)
  const touchStartX = useRef(0)
  const didDrag = useRef(false)

  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIdx, setLightboxIdx] = useState(0)
  const [lbDragOffset, setLbDragOffset] = useState(0)
  const lbTouchStartX = useRef(0)
  const lbDidDrag = useRef(false)

  const name = author?.displayName || author?.email || 'Unknown'
  const color = avatarColor(post.userId)
  const abbr = initials(name)
  const urls = (post.imageURLs ?? []).map(toWorkerUrl)
  const n = urls.length

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    didDrag.current = false
  }

  function handleTouchMove(e: React.TouchEvent) {
    const delta = e.touches[0].clientX - touchStartX.current
    if (Math.abs(delta) > 8) didDrag.current = true
    const atStart = imgIdx === 0 && delta > 0
    const atEnd = imgIdx === n - 1 && delta < 0
    setDragOffset(atStart || atEnd ? delta * 0.25 : delta)
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const delta = e.changedTouches[0].clientX - touchStartX.current
    if (!didDrag.current) {
      openLightbox(imgIdx)
    } else if (delta < -50 && imgIdx < n - 1) {
      setImgIdx(i => i + 1)
    } else if (delta > 50 && imgIdx > 0) {
      setImgIdx(i => i - 1)
    }
    setDragOffset(0)
  }

  function openLightbox(idx: number) {
    setLightboxIdx(idx)
    setLightboxOpen(true)
  }

  function handleLbTouchStart(e: React.TouchEvent) {
    lbTouchStartX.current = e.touches[0].clientX
    lbDidDrag.current = false
  }

  function handleLbTouchMove(e: React.TouchEvent) {
    const delta = e.touches[0].clientX - lbTouchStartX.current
    if (Math.abs(delta) > 8) lbDidDrag.current = true
    const atStart = lightboxIdx === 0 && delta > 0
    const atEnd = lightboxIdx === n - 1 && delta < 0
    setLbDragOffset(atStart || atEnd ? delta * 0.2 : delta)
  }

  function handleLbTouchEnd(e: React.TouchEvent) {
    e.preventDefault() // suppress synthetic click so underlying elements don't fire after close
    const delta = e.changedTouches[0].clientX - lbTouchStartX.current
    if (lbDidDrag.current) {
      if (delta < -50 && lightboxIdx < n - 1) setLightboxIdx(i => i + 1)
      else if (delta > 50 && lightboxIdx > 0) setLightboxIdx(i => i - 1)
    } else {
      setLightboxOpen(false)
    }
    setLbDragOffset(0)
  }

  useEffect(() => {
    if (!lightboxOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setLightboxOpen(false)
      if (e.key === 'ArrowRight' && lightboxIdx < n - 1) setLightboxIdx(i => i + 1)
      if (e.key === 'ArrowLeft' && lightboxIdx > 0) setLightboxIdx(i => i - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxOpen, lightboxIdx, n])

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
          className="relative bg-black overflow-hidden cursor-pointer"
          style={{ aspectRatio: '1/1', touchAction: 'pan-y' }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={() => { if (!didDrag.current) openLightbox(imgIdx) }}
        >
          {/* Sliding strip — all images laid out side-by-side */}
          <div
            style={{
              display: 'flex',
              width: `${n * 100}%`,
              height: '100%',
              transform: `translateX(calc(${-(imgIdx * 100) / n}% + ${dragOffset / n}px))`,
              transition: dragOffset !== 0 ? 'none' : 'transform 0.3s ease',
            }}
          >
            {urls.map((url, i) => (
              <div key={i} style={{ width: `${100 / n}%`, flexShrink: 0, height: '100%' }}>
                <img src={url} alt="" className="w-full h-full object-contain" />
              </div>
            ))}
          </div>

          {urls.length > 1 && (
            <>
              {/* Counter — visible on all screen sizes */}
              <div className="absolute top-2 right-2 bg-black/50 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                {imgIdx + 1}/{urls.length}
              </div>

              {/* Arrows — desktop only */}
              {imgIdx > 0 && (
                <button
                  onClick={e => { e.stopPropagation(); setImgIdx(i => i - 1) }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white hidden md:flex items-center justify-center transition"
                >
                  ‹
                </button>
              )}
              {imgIdx < urls.length - 1 && (
                <button
                  onClick={e => { e.stopPropagation(); setImgIdx(i => i + 1) }}
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
        <div className="px-4 pt-3 pb-2">
          <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">{post.caption}</p>
        </div>
      )}

      <ReactionBar postId={post.id} postAuthorId={post.userId} currentUserId={currentUserId} userMap={userMap} />

      <CommentSection
        postId={post.id}
        postAuthorId={post.userId}
        currentUserId={currentUserId}
        userMap={userMap}
      />

      {/* Lightbox */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black overflow-hidden"
          style={{ touchAction: 'none' }}
          onTouchStart={handleLbTouchStart}
          onTouchMove={handleLbTouchMove}
          onTouchEnd={handleLbTouchEnd}
        >
          {/* Sliding strip — same approach as the feed carousel */}
          <div
            style={{
              display: 'flex',
              width: `${n * 100}%`,
              height: '100%',
              transform: `translateX(calc(${-(lightboxIdx * 100) / n}% + ${lbDragOffset / n}px))`,
              transition: lbDragOffset !== 0 ? 'none' : 'transform 0.3s ease',
            }}
          >
            {urls.map((url, i) => (
              <div
                key={i}
                style={{ width: `${100 / n}%`, flexShrink: 0, height: '100%' }}
                className="flex items-center justify-center"
              >
                <img src={url} alt="" className="max-w-full max-h-full object-contain select-none" draggable={false} />
              </div>
            ))}
          </div>

          {/* Close */}
          <button
            onTouchEnd={e => { e.stopPropagation(); e.preventDefault(); setLightboxOpen(false) }}
            onClick={e => { e.stopPropagation(); setLightboxOpen(false) }}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition z-10"
            style={{ marginTop: 'env(safe-area-inset-top)' }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Desktop arrows */}
          {lightboxIdx > 0 && (
            <button
              onClick={e => { e.stopPropagation(); setLightboxIdx(i => i - 1) }}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white text-xl flex items-center justify-center transition hidden md:flex"
            >
              ‹
            </button>
          )}
          {lightboxIdx < n - 1 && (
            <button
              onClick={e => { e.stopPropagation(); setLightboxIdx(i => i + 1) }}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white text-xl flex items-center justify-center transition hidden md:flex"
            >
              ›
            </button>
          )}

          {/* Dots */}
          {n > 1 && (
            <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2">
              {urls.map((_, i) => (
                <button
                  key={i}
                  onTouchEnd={e => { e.stopPropagation(); e.preventDefault(); setLightboxIdx(i) }}
                  onClick={e => { e.stopPropagation(); setLightboxIdx(i) }}
                  className={`w-2 h-2 rounded-full transition-colors ${i === lightboxIdx ? 'bg-white' : 'bg-white/30'}`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
