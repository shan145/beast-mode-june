import { useState, useEffect, useRef, useCallback } from 'react'
import type { DocumentSnapshot } from 'firebase/firestore'
import { fetchPostsPage } from '@/lib/firestore'
import type { Post } from '@/types'

const PAGE_SIZE = 10

export function usePagedPosts() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [hasNext, setHasNext] = useState(false)

  // cursors[n] is the startAfter doc for page n (null = no cursor = first page)
  // Using a ref so saving a new cursor doesn't trigger a re-render or re-fetch
  const cursors = useRef<(DocumentSnapshot | null)[]>([null])

  const loadPage = useCallback(async (pageIndex: number) => {
    setLoading(true)
    const { posts: fetched, lastDoc } = await fetchPostsPage(
      PAGE_SIZE,
      cursors.current[pageIndex] ?? undefined,
    )
    setPosts(fetched)
    const more = fetched.length === PAGE_SIZE
    setHasNext(more)
    if (more && lastDoc && !cursors.current[pageIndex + 1]) {
      cursors.current[pageIndex + 1] = lastDoc
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadPage(page)
  }, [page, loadPage])

  function goNext() { setPage(p => p + 1) }
  function goPrev() { setPage(p => p - 1) }

  // Call after creating or deleting a post to re-fetch the current page
  function refresh() {
    // Clear cursors ahead of the current page since ordering may have changed
    cursors.current = cursors.current.slice(0, page + 1)
    loadPage(page)
  }

  return {
    posts,
    loading,
    page,
    hasNext,
    hasPrev: page > 0,
    goNext,
    goPrev,
    refresh,
  }
}
