import type { Timestamp } from 'firebase/firestore'

export interface UserProfile {
  uid: string
  email: string
  displayName: string
  photoURL: string
  joinedAt: Timestamp
}

export interface GoalFrequency {
  type: 'daily' | 'weekly'
  daysPerWeek: number
  totalDays: number
}

export interface Goal {
  id: string
  userId: string
  title: string
  description: string
  frequency: GoalFrequency
  createdAt: Timestamp
  active: boolean
}

export interface Completion {
  id: string
  goalId: string
  userId: string
  date: string        // "YYYY-MM-DD" Eastern Time
  completedAt: Timestamp
}

export interface Post {
  id: string
  userId: string
  imageURLs: string[]
  caption: string
  createdAt: Timestamp | null
}

export interface Comment {
  id: string
  postId: string
  userId: string
  text: string
  createdAt: Timestamp | null
}

export interface Reaction {
  id: string
  postId: string
  userId: string
  emoji: string
  createdAt: Timestamp | null
}

export interface Kudos {
  id: string
  fromUserId: string
  toUserId: string
  type: 'beast' | 'celebration'
  date: string        // "YYYY-MM-DD" Eastern Time — the day the recipient completed all tasks
  createdAt: Timestamp | null
}

// Derived type used by the calendar/checklist
export interface DayState {
  date: string
  goals: Array<{
    goal: Goal
    completions: Completion[]
    isComplete: boolean
    isWeekly: boolean
    weekStart: string   // "YYYY-MM-DD" of the Sunday starting that week
    weekEnd: string     // "YYYY-MM-DD" of the Saturday ending that week
  }>
}
