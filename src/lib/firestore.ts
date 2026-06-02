import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  query,
  where,
  orderBy,
  getDocs,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Goal, Completion, UserProfile, GoalFrequency, Post, Comment, Reaction } from '@/types'

// ---- Users ----

export async function upsertUser(profile: Omit<UserProfile, 'joinedAt'>) {
  const userRef = doc(db, 'users', profile.uid)
  const snap = await getDoc(userRef)
  // Never overwrite a custom displayName the user may have set
  const data = snap.exists()
    ? { email: profile.email, photoURL: profile.photoURL, joinedAt: serverTimestamp() }
    : { ...profile, joinedAt: serverTimestamp() }
  await setDoc(userRef, data, { merge: true })
}

export async function updateUserDisplayName(uid: string, displayName: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { displayName: displayName.trim() })
}

export function subscribeToUsers(cb: (users: UserProfile[]) => void): Unsubscribe {
  return onSnapshot(collection(db, 'users'), snap => {
    cb(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)))
  })
}

export function subscribeToUser(uid: string, cb: (user: UserProfile | null) => void): Unsubscribe {
  return onSnapshot(doc(db, 'users', uid), snap => {
    cb(snap.exists() ? ({ uid: snap.id, ...snap.data() } as UserProfile) : null)
  })
}

export function subscribeToAllGoals(cb: (goals: Goal[]) => void): Unsubscribe {
  const q = query(collection(db, 'goals'), where('active', '==', true))
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as Goal)))
  })
}

export function subscribeToAllCompletions(cb: (completions: Completion[]) => void): Unsubscribe {
  return onSnapshot(collection(db, 'completions'), snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as Completion)))
  })
}

// ---- Goals ----

export function subscribeToGoals(userId: string, cb: (goals: Goal[]) => void): Unsubscribe {
  const q = query(collection(db, 'goals'), where('userId', '==', userId), where('active', '==', true))
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as Goal)))
  })
}

export async function createGoal(userId: string, data: { title: string; description: string; frequency: GoalFrequency }) {
  await addDoc(collection(db, 'goals'), {
    ...data,
    userId,
    active: true,
    createdAt: serverTimestamp(),
  })
}

export async function updateGoal(goalId: string, data: Partial<Pick<Goal, 'title' | 'description' | 'frequency'>>) {
  await updateDoc(doc(db, 'goals', goalId), data)
}

export async function deleteGoal(goalId: string) {
  await updateDoc(doc(db, 'goals', goalId), { active: false })
}

// ---- Completions ----

export function subscribeToCompletions(userId: string, cb: (completions: Completion[]) => void): Unsubscribe {
  const q = query(collection(db, 'completions'), where('userId', '==', userId))
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as Completion)))
  })
}

export async function addCompletion(userId: string, goalId: string, date: string): Promise<void> {
  // Idempotent: check for existing completion first
  const q = query(
    collection(db, 'completions'),
    where('userId', '==', userId),
    where('goalId', '==', goalId),
    where('date', '==', date),
  )
  const existing = await getDocs(q)
  if (!existing.empty) return

  await addDoc(collection(db, 'completions'), {
    userId,
    goalId,
    date,
    completedAt: serverTimestamp(),
  })
}

export async function removeCompletion(userId: string, goalId: string, date: string): Promise<void> {
  const q = query(
    collection(db, 'completions'),
    where('userId', '==', userId),
    where('goalId', '==', goalId),
    where('date', '==', date),
  )
  const snap = await getDocs(q)
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)))
}

// ---- Posts ----

export function subscribeToPosts(cb: (posts: Post[]) => void): Unsubscribe {
  const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'))
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as Post)))
  })
}

export async function createPost(
  userId: string,
  data: { imageURLs: string[]; caption: string },
): Promise<void> {
  await addDoc(collection(db, 'posts'), {
    ...data,
    userId,
    createdAt: serverTimestamp(),
  })
}

export async function updatePost(
  postId: string,
  data: Partial<Pick<Post, 'caption' | 'imageURLs'>>,
): Promise<void> {
  await updateDoc(doc(db, 'posts', postId), data)
}

export async function deletePost(postId: string): Promise<void> {
  await deleteDoc(doc(db, 'posts', postId))
}

// ---- Comments ----

export function subscribeToComments(postId: string, cb: (comments: Comment[]) => void): Unsubscribe {
  const q = query(collection(db, 'comments'), where('postId', '==', postId))
  return onSnapshot(q, snap => {
    const comments = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as Comment))
      .sort((a, b) => (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0))
    cb(comments)
  })
}

export async function addComment(userId: string, postId: string, text: string): Promise<void> {
  await addDoc(collection(db, 'comments'), {
    postId,
    userId,
    text: text.trim(),
    createdAt: serverTimestamp(),
  })
}

export async function updateComment(commentId: string, text: string): Promise<void> {
  await updateDoc(doc(db, 'comments', commentId), { text: text.trim() })
}

export async function deleteComment(commentId: string): Promise<void> {
  await deleteDoc(doc(db, 'comments', commentId))
}

// ---- Reactions ----

export function subscribeToReactions(postId: string, cb: (reactions: Reaction[]) => void): Unsubscribe {
  const q = query(collection(db, 'reactions'), where('postId', '==', postId))
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as Reaction)))
  })
}

export async function toggleReaction(userId: string, postId: string, emoji: string): Promise<void> {
  try {
    const q = query(
      collection(db, 'reactions'),
      where('postId', '==', postId),
      where('userId', '==', userId),
      where('emoji', '==', emoji),
    )
    const existing = await getDocs(q)
    if (!existing.empty) {
      await Promise.all(existing.docs.map(d => deleteDoc(d.ref)))
    } else {
      await addDoc(collection(db, 'reactions'), { postId, userId, emoji, createdAt: serverTimestamp() })
    }
  } catch (err) {
    console.error('toggleReaction failed:', err)
  }
}
