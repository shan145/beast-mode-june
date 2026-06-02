import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { usePosts } from '@/hooks/usePosts'
import { useUsers } from '@/hooks/useUsers'
import { deletePost as deletePostDoc } from '@/lib/firestore'
import type { Post } from '@/types'
import PostCard from './PostCard'
import PostForm from './PostForm'

export default function Feed() {
  const { firebaseUser } = useAuth()
  const { posts, loading } = usePosts()
  const { users } = useUsers()
  const [showForm, setShowForm] = useState(false)
  const [editingPost, setEditingPost] = useState<Post | null>(null)
  const [showBanner, setShowBanner] = useState(true)
  const [deletingPost, setDeletingPost] = useState<Post | null>(null)
  const [deleting, setDeleting] = useState(false)

  const userMap = Object.fromEntries(users.map(u => [u.uid, u]))

  async function confirmDelete() {
    if (!deletingPost) return
    setDeleting(true)
    await deletePostDoc(deletingPost.id)
    setDeleting(false)
    setDeletingPost(null)
  }

  return (
    <>
      {showBanner && (
        <div className="flex items-start gap-3 bg-yellow-50 dark:bg-yellow-950/40 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300 rounded-xl px-4 py-3 mb-5 text-sm">
          <span className="mt-0.5">⚠️</span>
          <p className="flex-1"><span className="font-semibold">Photo uploads are temporarily broken.</span> We're working on a fix.</p>
          <button onClick={() => setShowBanner(false)} className="shrink-0 text-yellow-500 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-200 transition text-lg leading-none">✕</button>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Feed</h2>
        <button
          onClick={() => setShowForm(true)}
          className="bg-orange-500 hover:bg-orange-400 text-white font-semibold rounded-lg px-4 py-2 text-sm transition"
        >
          + New post
        </button>
      </div>

      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2].map(i => <div key={i} className="h-64 bg-gray-200 dark:bg-gray-800 rounded-2xl" />)}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <p className="text-lg mb-1 text-gray-500 dark:text-gray-400">No posts yet</p>
          <p className="text-sm">Share your first progress update!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              author={userMap[post.userId]}
              isOwn={post.userId === firebaseUser?.uid}
              currentUserId={firebaseUser?.uid ?? ''}
              userMap={userMap}
              onEdit={() => setEditingPost(post)}
              onDelete={() => setDeletingPost(post)}
            />
          ))}
        </div>
      )}

      {(showForm || editingPost) && firebaseUser && (
        <PostForm
          userId={firebaseUser.uid}
          post={editingPost ?? undefined}
          onClose={() => { setShowForm(false); setEditingPost(null) }}
        />
      )}

      {deletingPost && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-sm shadow-xl border border-gray-100 dark:border-transparent">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete post?</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">This can't be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingPost(null)}
                className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg py-2.5 text-sm transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg py-2.5 text-sm transition disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
