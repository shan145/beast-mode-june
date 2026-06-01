import { useState, useEffect } from 'react'
import { subscribeToPosts } from '@/lib/firestore'
import type { Post } from '@/types'

export function usePosts() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return subscribeToPosts(p => {
      setPosts(p)
      setLoading(false)
    })
  }, [])

  return { posts, loading }
}
