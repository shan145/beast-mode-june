# Step 6: Migrate Firestore Data to D1 (Optional)

## When to do this

Only if Firestore costs become a concern at scale. At 1,000 users, Firestore's free tier (50K reads/day, 20K writes/day) may be exceeded by community views and the leaderboard, which subscribe to all goals and completions. D1 is cheaper at volume and gives you SQL queries.

**Do not do this prematurely** — it adds migration complexity and Firestore real-time subscriptions are a meaningful feature.

## D1 schema additions

Add to `workers/api/schema.sql`:
```sql
CREATE TABLE IF NOT EXISTS goals (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  freq_type    TEXT NOT NULL,   -- 'daily' | 'weekly'
  days_per_week INTEGER NOT NULL,
  total_days   INTEGER NOT NULL,
  active       INTEGER NOT NULL DEFAULT 1,  -- boolean
  created_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_active ON goals(active);

CREATE TABLE IF NOT EXISTS completions (
  id           TEXT PRIMARY KEY,
  goal_id      TEXT NOT NULL,
  user_id      TEXT NOT NULL,
  date         TEXT NOT NULL,   -- "YYYY-MM-DD" Eastern Time
  completed_at TEXT NOT NULL,
  UNIQUE(goal_id, user_id, date)   -- idempotency constraint
);

CREATE INDEX IF NOT EXISTS idx_comp_user ON completions(user_id);
CREATE INDEX IF NOT EXISTS idx_comp_goal ON completions(goal_id);
CREATE INDEX IF NOT EXISTS idx_comp_date ON completions(date);
```

## Migration script

A one-time script that reads everything from Firestore and writes it to D1:

`workers/api/src/scripts/migrateFirestore.ts`:
```ts
// Run via: wrangler dev, then POST /internal/migrate
// Requires FIREBASE_PROJECT_ID and DB binding
export async function migrateFirestoreToD1(env: Env) {
  const projectId = env.FIREBASE_PROJECT_ID
  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`

  const [goalsSnap, completionsSnap] = await Promise.all([
    fetchAllDocs(`${base}/goals`),
    fetchAllDocs(`${base}/completions`),
  ])

  // Batch insert goals
  const goalStmt = env.DB.prepare(
    `INSERT OR IGNORE INTO goals (id, user_id, title, description, freq_type, days_per_week, total_days, active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
  await env.DB.batch(goalsSnap.map(g => goalStmt.bind(
    g.id, g.userId, g.title, g.description ?? '',
    g.frequency.type, g.frequency.daysPerWeek, g.frequency.totalDays,
    g.active ? 1 : 0, g.createdAt ?? new Date().toISOString()
  )))

  // Batch insert completions
  const compStmt = env.DB.prepare(
    `INSERT OR IGNORE INTO completions (id, goal_id, user_id, date, completed_at) VALUES (?, ?, ?, ?, ?)`
  )
  await env.DB.batch(completionsSnap.map(c => compStmt.bind(
    c.id, c.goalId, c.userId, c.date, c.completedAt ?? new Date().toISOString()
  )))

  return { goals: goalsSnap.length, completions: completionsSnap.length }
}
```

## Cutover strategy

Do a **dual-write** period rather than a hard cutover:
1. Write to both Firestore and D1 simultaneously
2. Read from D1 for new features; keep reading from Firestore for existing UI
3. After a week with no issues, switch reads to D1
4. Remove Firestore write paths

This means no downtime and easy rollback.

## React changes

Replace Firestore hooks (`useGoals`, `useCompletions`, `useAllGoals`, `useAllCompletions`) with equivalents that call `apiFetch`. The D1-backed Worker routes return the same shape as the Firestore hooks, so component code should need minimal changes.

Real-time subscriptions (Firestore's `onSnapshot`) become polling or WebSocket-push from the Worker — decide based on how real-time you need the data to be.

## Done when

- All goals and completions exist in D1 with row counts matching Firestore
- At least one read path (e.g. leaderboard) is confirmed reading from D1
- Firestore read counts drop measurably
