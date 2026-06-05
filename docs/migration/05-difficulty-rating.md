# Step 5: Smart Difficulty Rating (Cron Trigger)

## What to build

A scheduled Worker job that runs every Monday at 4am UTC (Sunday midnight ET). It reads all users' completion data for the prior week from Firestore, computes a difficulty score per goal, and writes suggestions to D1. The React dashboard surfaces these suggestions.

## D1 schema

Add to `workers/api/schema.sql`:
```sql
CREATE TABLE IF NOT EXISTS difficulty_scores (
  user_id         TEXT NOT NULL,
  goal_id         TEXT NOT NULL,
  week_start      TEXT NOT NULL,   -- "YYYY-MM-DD" Sunday in ET
  completion_rate REAL NOT NULL,   -- 0.0 – 1.0
  suggestion      TEXT,            -- null if no adjustment needed
  PRIMARY KEY (user_id, goal_id, week_start)
);
```

## Scoring logic

| Completion rate | Suggestion |
|---|---|
| ≥ 0.9 | `"crushing_it"` — offer to increase frequency |
| 0.6 – 0.89 | `null` — on track, no change |
| 0.3 – 0.59 | `"struggling"` — offer to decrease frequency |
| < 0.3 | `"overwhelmed"` — offer to pause or reduce significantly |

## Cron handler

`workers/api/src/cron/difficultyRating.ts`:
```ts
import type { Env } from '../types'

export async function runDifficultyRating(env: Env) {
  // Fetch all users, goals, and completions from Firestore via REST API
  const projectId = env.FIREBASE_PROJECT_ID
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`

  const [goalsRes, completionsRes] = await Promise.all([
    fetch(`${baseUrl}/goals?pageSize=300`),
    fetch(`${baseUrl}/completions?pageSize=10000`),
  ])

  const goals = parseFirestoreDocs(await goalsRes.json())
  const completions = parseFirestoreDocs(await completionsRes.json())

  const weekStart = lastSundayET()
  const weekEnd = addDays(weekStart, 6)

  // Group completions by (userId, goalId) for the prior week
  const weekCompletions: Record<string, Record<string, number>> = {}
  for (const c of completions) {
    if (c.date < weekStart || c.date > weekEnd) continue
    weekCompletions[c.userId] ??= {}
    weekCompletions[c.userId][c.goalId] = (weekCompletions[c.userId][c.goalId] ?? 0) + 1
  }

  const stmt = env.DB.prepare(
    `INSERT OR REPLACE INTO difficulty_scores (user_id, goal_id, week_start, completion_rate, suggestion)
     VALUES (?, ?, ?, ?, ?)`
  )

  const batch = []
  for (const goal of goals) {
    if (!goal.active) continue
    const required = goal.frequency.type === 'daily' ? 7 : goal.frequency.daysPerWeek
    const actual = weekCompletions[goal.userId]?.[goal.id] ?? 0
    const rate = actual / required
    const suggestion = rateSuggestion(rate)
    batch.push(stmt.bind(goal.userId, goal.id, weekStart, rate, suggestion))
  }

  await env.DB.batch(batch)
}

function rateSuggestion(rate: number): string | null {
  if (rate >= 0.9) return 'crushing_it'
  if (rate >= 0.6) return null
  if (rate >= 0.3) return 'struggling'
  return 'overwhelmed'
}
```

Wire up the cron in `index.ts`:
```ts
import { runDifficultyRating } from './cron/difficultyRating'

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env) {
    await runDifficultyRating(env)
  },
}
```

`wrangler.toml`:
```toml
[triggers]
crons = ["0 4 * * MON"]
```

## Worker route (for React to read suggestions)

```ts
app.get('/api/difficulty', async (c) => {
  const userId = c.get('userId')
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM difficulty_scores WHERE user_id = ? ORDER BY week_start DESC LIMIT 10`
  ).bind(userId).all()
  return c.json(results)
})
```

## React integration

Add a `useDifficultyScores` hook that calls `apiFetch('/api/difficulty')`. Surface suggestions on `GoalCard` — e.g. a subtle badge: "You're crushing this 🔥" or "Want to adjust this goal?".

## Testing the cron locally

```bash
wrangler dev
# In another terminal:
curl "http://localhost:8787/__scheduled?cron=0+4+*+*+MON"
```

## Done when

- Cron runs without errors in production (check via `wrangler tail`)
- D1 `difficulty_scores` table has rows after the first Monday run
- Dashboard surfaces at least one suggestion to a user

## Next

[Step 6 — Migrate Firestore data to D1 (optional)](./06-migrate-data.md)
