# Migration Overview: Firebase → Hono + Cloudflare

## Goal

Add a dedicated backend (Hono on Cloudflare Workers) for new features: real-time chat, user challenges, and smart difficulty ratings. Firebase Auth stays permanently as the identity layer. Existing Firestore data migrates only if costs warrant it.

## Architecture

```
React client
  ├── Firebase Auth (stays forever — Google sign-in)
  ├── Firestore (existing goals/completions/feed — migrate gradually)
  └── Hono Worker (new features + future home of all data)
        ├── D1 (SQLite) — challenges, difficulty scores
        ├── Durable Objects — WebSocket chat rooms
        └── Cron Triggers — weekly difficulty analysis job
```

## Feature Routing

| Feature | Lives in | Status |
|---|---|---|
| Goals CRUD | Firestore | Existing — migrate to D1 later if costs grow |
| Completions | Firestore | Existing — same |
| Feed (posts, comments, reactions) | Firestore | Existing — same |
| Friend requests / challenges | D1 via Worker | New — starts on Worker |
| Real-time chat | Durable Objects | New |
| Difficulty ratings | D1 + Cron Trigger | New |

## Steps

1. [Scaffold the Worker](./01-scaffold-worker.md)
2. [Auth middleware](./02-auth-middleware.md)
3. [Challenges & friend requests](./03-challenges.md)
4. [Real-time chat](./04-chat.md)
5. [Difficulty rating](./05-difficulty-rating.md)
6. [Migrate Firestore data to D1](./06-migrate-data.md) *(optional)*
