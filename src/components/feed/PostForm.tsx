import { useState, useRef } from 'react'
import type { Post } from '@/types'
import { createPost, updatePost } from '@/lib/firestore'
import { uploadPostImages } from '@/lib/storage'
import { sendNotification } from '@/lib/pushNotifications'
import { auth } from '@/lib/firebase'

interface Props {
  userId: string
  post?: Post
  onClose: () => void
}

const MAX_IMAGES = 10

export default function PostForm({ userId, post, onClose }: Props) {
  const [keptURLs, setKeptURLs] = useState<string[]>(post?.imageURLs ?? [])
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([])
  const [caption, setCaption] = useState(post?.caption ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const totalCount = keptURLs.length + pendingFiles.length
  const canAddMore = totalCount < MAX_IMAGES

  function handleFiles(fileList: FileList) {
    const incoming = Array.from(fileList).slice(0, MAX_IMAGES - totalCount)
    const previews = incoming.map(f => URL.createObjectURL(f))
    setPendingFiles(prev => [...prev, ...incoming])
    setPendingPreviews(prev => [...prev, ...previews])
    setError('')
  }

  function removeKept(idx: number) {
    setKeptURLs(prev => prev.filter((_, i) => i !== idx))
  }

  function removePending(idx: number) {
    URL.revokeObjectURL(pendingPreviews[idx])
    setPendingFiles(prev => prev.filter((_, i) => i !== idx))
    setPendingPreviews(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit() {
    if (keptURLs.length === 0 && pendingFiles.length === 0) {
      setError('Please add at least one image.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const uploadedURLs = await uploadPostImages(pendingFiles)
      const imageURLs = [...keptURLs, ...uploadedURLs]
      if (post) {
        await updatePost(post.id, { caption, imageURLs })
      } else {
        const postId = await createPost(userId, { imageURLs, caption })
        const name = auth.currentUser?.displayName ?? 'Someone'
        sendNotification('feed-post', { userName: name, postId }, { excludeUserId: userId })
      }
      onClose()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-md shadow-xl border border-gray-100 dark:border-transparent max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {post ? 'Edit post' : 'New post'}
        </h2>

        {/* Image grid */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {keptURLs.map((url, i) => (
            <div key={`kept-${i}`} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => removeKept(i)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-xs flex items-center justify-center hover:bg-black/80 transition"
              >
                ×
              </button>
            </div>
          ))}

          {pendingPreviews.map((src, i) => (
            <div key={`pending-${i}`} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800">
              <img src={src} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => removePending(i)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-xs flex items-center justify-center hover:bg-black/80 transition"
              >
                ×
              </button>
            </div>
          ))}

          {canAddMore && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="aspect-square rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-orange-400 transition-colors flex flex-col items-center justify-center text-gray-400 dark:text-gray-500"
            >
              <svg className="w-6 h-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-xs">{totalCount === 0 ? 'Add photos' : 'Add more'}</span>
            </button>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => e.target.files && handleFiles(e.target.files)}
        />

        <textarea
          value={caption}
          onChange={e => setCaption(e.target.value)}
          placeholder="Write something... (optional)"
          rows={3}
          className="w-full rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-500 mb-4"
        />

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg py-2.5 text-sm transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 bg-orange-500 hover:bg-orange-400 text-white font-semibold rounded-lg py-2.5 text-sm transition disabled:opacity-50"
          >
            {submitting ? (post ? 'Saving...' : 'Posting...') : (post ? 'Save' : 'Post')}
          </button>
        </div>
      </div>
    </div>
  )
}
