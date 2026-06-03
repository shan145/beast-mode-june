import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import type { Comment, UserProfile } from '@/types'
import { subscribeToComments, addComment, updateComment, deleteComment } from '@/lib/firestore'
import { sendNotification } from '@/lib/pushNotifications'
import { auth } from '@/lib/firebase'

interface Props {
  postId: string
  postAuthorId: string
  currentUserId: string
  userMap: Record<string, UserProfile>
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

const COLLAPSE_AT = 3

export default function CommentSection({ postId, postAuthorId, currentUserId, userMap }: Props) {
  const [comments, setComments] = useState<Comment[]>([])
  const [expanded, setExpanded] = useState(false)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return subscribeToComments(postId, setComments)
  }, [postId])

  useEffect(() => {
    if (editingId) editInputRef.current?.focus()
  }, [editingId])

  // Close dropdown when tapping elsewhere
  useEffect(() => {
    if (!openMenuId) return
    function handleClick() { setOpenMenuId(null) }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [openMenuId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || submitting) return
    setSubmitting(true)
    await addComment(currentUserId, postId, trimmed)
    setText('')
    setSubmitting(false)

    // Notify: post author + all existing commenters, excluding the commenter themselves
    const recipientIds = Array.from(new Set([
      postAuthorId,
      ...comments.map(c => c.userId),
    ])).filter(id => id !== currentUserId)
    if (recipientIds.length > 0) {
      const name = auth.currentUser?.displayName ?? 'Someone'
      sendNotification('feed-comment', { userName: name, postId }, { recipientIds })
    }
  }

  function startEdit(comment: Comment) {
    setEditingId(comment.id)
    setEditText(comment.text)
    setOpenMenuId(null)
  }

  async function submitEdit(commentId: string) {
    const trimmed = editText.trim()
    if (trimmed) await updateComment(commentId, trimmed)
    setEditingId(null)
  }

  return (
    <div className="px-4 pb-4 pt-1 border-t border-gray-100 dark:border-gray-800">
      {comments.length > 0 && (
        <div className="space-y-2 mb-3 mt-2">
          {!expanded && comments.length > COLLAPSE_AT && (
            <button
              onClick={() => setExpanded(true)}
              className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition"
            >
              View {comments.length - COLLAPSE_AT} more comment{comments.length - COLLAPSE_AT > 1 ? 's' : ''}
            </button>
          )}
          {(expanded ? comments : comments.slice(-COLLAPSE_AT)).map(comment => {
            const author = userMap[comment.userId]
            const name = author?.displayName || author?.email || 'Unknown'
            const color = avatarColor(comment.userId)
            const abbr = initials(name)
            const isOwn = comment.userId === currentUserId
            const isEditing = editingId === comment.id

            return (
              <div key={comment.id} className="flex items-center gap-2 group">
                <Link to={`/member/${comment.userId}`} className="shrink-0">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ backgroundColor: color }}
                  >
                    {abbr}
                  </div>
                </Link>

                {isEditing ? (
                  <form
                    onSubmit={e => { e.preventDefault(); submitEdit(comment.id) }}
                    className="flex items-center gap-2 flex-1 min-w-0"
                  >
                    <input
                      ref={editInputRef}
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      onKeyDown={e => e.key === 'Escape' && setEditingId(null)}
                      maxLength={500}
                      className="flex-1 text-sm bg-gray-100 dark:bg-gray-800 rounded-full px-3 py-1 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-400 transition"
                    />
                    <button type="submit" className="text-xs font-semibold text-orange-500 hover:text-orange-400 shrink-0">Save</button>
                    <button type="button" onClick={() => setEditingId(null)} className="text-xs text-gray-400 hover:text-gray-600 shrink-0">Cancel</button>
                  </form>
                ) : (
                  <>
                    <p className="flex-1 text-xs text-gray-800 dark:text-gray-200 break-words min-w-0">
                      <Link to={`/member/${comment.userId}`} className="font-bold mr-1.5 hover:underline">{name}</Link>
                      {comment.text}
                    </p>

                    {isOwn && (
                      <>
                        {/* Desktop: inline hover buttons */}
                        <div className="hidden md:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                          <button
                            onClick={() => startEdit(comment)}
                            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          >
                            Edit
                          </button>
                          <span className="text-gray-300 dark:text-gray-600 text-xs">·</span>
                          <button
                            onClick={() => deleteComment(comment.id)}
                            className="text-xs text-red-400 hover:text-red-500"
                          >
                            Delete
                          </button>
                        </div>

                        {/* Mobile: ellipsis + dropdown */}
                        <div className="md:hidden relative shrink-0">
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              setOpenMenuId(openMenuId === comment.id ? null : comment.id)
                            }}
                            className="text-gray-400 dark:text-gray-500 px-1 text-base leading-none"
                          >
                            ···
                          </button>
                          {openMenuId === comment.id && (
                            <div className="absolute right-0 bottom-full mb-1 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden z-20 min-w-[100px]">
                              <button
                                onClick={() => startEdit(comment)}
                                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => { deleteComment(comment.id); setOpenMenuId(null) }}
                                className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-2">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Add a comment…"
          maxLength={500}
          className="flex-1 text-sm bg-gray-100 dark:bg-gray-800 rounded-full px-3 py-1.5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:ring-2 focus:ring-orange-400 transition"
        />
        {text.trim() && (
          <button
            type="submit"
            disabled={submitting}
            className="text-sm font-semibold text-orange-500 hover:text-orange-400 disabled:opacity-50 shrink-0 transition"
          >
            Post
          </button>
        )}
      </form>
    </div>
  )
}
