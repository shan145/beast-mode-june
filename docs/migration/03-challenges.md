# Step 3: Challenges & Friend Requests

## What to build

Two features backed by D1:
- **Friend requests** — send, accept, reject between users
- **Challenges** — challenge another user on a specific goal

## D1 schema

Run via `wrangler d1 execute beast-mode-db --file=workers/api/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS friend_requests (
  id         TEXT PRIMARY KEY,
  from_user  TEXT NOT NULL,
  to_user    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | rejected
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fr_to_user ON friend_requests(to_user);
CREATE INDEX IF NOT EXISTS idx_fr_from_user ON friend_requests(from_user);

CREATE TABLE IF NOT EXISTS challenges (
  id         TEXT PRIMARY KEY,
  from_user  TEXT NOT NULL,
  to_user    TEXT NOT NULL,
  goal_id    TEXT NOT NULL,   -- references a Firestore goal id
  status     TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | rejected
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ch_to_user ON challenges(to_user);
CREATE INDEX IF NOT EXISTS idx_ch_from_user ON challenges(from_user);
```

## Worker routes

`workers/api/src/routes/social.ts`:
```ts
import { Hono } from 'hono'
import { nanoid } from 'nanoid'

const social = new Hono()

// Friend requests
social.get('/friend-requests', async (c) => {
  const userId = c.get('userId')
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM friend_requests WHERE to_user = ? OR from_user = ?`
  ).bind(userId, userId).all()
  return c.json(results)
})

social.post('/friend-requests', async (c) => {
  const userId = c.get('userId')
  const { toUser } = await c.req.json<{ toUser: string }>()
  const id = nanoid()
  const now = new Date().toISOString()
  await c.env.DB.prepare(
    `INSERT INTO friend_requests (id, from_user, to_user, status, created_at) VALUES (?, ?, ?, 'pending', ?)`
  ).bind(id, userId, toUser, now).run()
  return c.json({ id }, 201)
})

social.patch('/friend-requests/:id', async (c) => {
  const userId = c.get('userId')
  const { status } = await c.req.json<{ status: 'accepted' | 'rejected' }>()
  await c.env.DB.prepare(
    `UPDATE friend_requests SET status = ? WHERE id = ? AND to_user = ?`
  ).bind(status, c.req.param('id'), userId).run()
  return c.json({ ok: true })
})

// Challenges — same pattern
social.post('/challenges', async (c) => {
  const userId = c.get('userId')
  const { toUser, goalId } = await c.req.json<{ toUser: string; goalId: string }>()
  const id = nanoid()
  const now = new Date().toISOString()
  await c.env.DB.prepare(
    `INSERT INTO challenges (id, from_user, to_user, goal_id, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)`
  ).bind(id, userId, toUser, goalId, now).run()
  return c.json({ id }, 201)
})

social.patch('/challenges/:id', async (c) => {
  const userId = c.get('userId')
  const { status } = await c.req.json<{ status: 'accepted' | 'rejected' }>()
  await c.env.DB.prepare(
    `UPDATE challenges SET status = ? WHERE id = ? AND to_user = ?`
  ).bind(status, c.req.param('id'), userId).run()
  return c.json({ ok: true })
})

export default social
```

Mount in `index.ts`:
```ts
import social from './routes/social'
app.route('/api', social)
```

## React integration

Add hooks `useFriendRequests` and `useChallenges` that call `apiFetch` from step 2. Wire into the community/member views.

## Done when

- Can send and accept/reject a friend request end-to-end
- Can send and accept/reject a challenge end-to-end
- All routes return 401 without a valid token

## Next

[Step 4 — Real-time chat](./04-chat.md)
