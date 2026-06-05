export interface Env {
  FIREBASE_PROJECT_ID: string
  DB: D1Database
  CHAT_ROOM: DurableObjectNamespace
}

export type Variables = {
  userId: string
}
