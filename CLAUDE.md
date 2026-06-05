# CLAUDE.md — Beast Mode June

This file helps Claude understand the project so it can give you accurate, context-aware help.

---

## Project Overview

Beast Mode June is a small-group accountability web app for tracking quantifiable June goals. ~10–15 users, all known, no public access. Core data (goals, completions, feed) lives in Firestore. Images go through Cloudinary; push notifications and image CDN caching run through lightweight Cloudflare Workers.

---

## Tech Stack

- **React 18 + TypeScript** via Vite
- **Tailwind CSS** for all styling
- **Firebase Auth** — Google sign-in only, plus a client-side group password gate (set via `VITE_GROUP_PASSWORD` env var)
- **Firestore** — real-time database for goals, completions, feed posts, comments, reactions, kudos
- **Cloudinary** — image hosting and transformation for feed posts (`VITE_CLOUDINARY_CLOUD_NAME`, `VITE_CLOUDINARY_UPLOAD_PRESET`)
- **Cloudflare Workers** — three workers in `workers/`:
  - `workers/images/` — proxies Cloudinary URLs for CDN caching (`VITE_IMAGE_CDN_URL`)
  - `workers/notifications/` — handles Web Push subscriptions and delivery (`VITE_NOTIFICATIONS_WORKER_URL`, `VITE_VAPID_PUBLIC_KEY`)
  - `workers/api/` — Hono API for new features (in progress — see `docs/migration/`)
- **canvas-confetti** — celebration animations on task completion
- **React Context** — `useAuth` for auth state, `ThemeContext` for dark/light mode; component-local state for everything else

---

## Project Structure

```
src/
  components/
    ui/           # CelebrationFireworks, CelebrationGift, NavTabs, ProgressRing
    goals/        # GoalCard, GoalForm
    calendar/     # JuneCalendar, DayCell, WeekRow, DayLogModal
    checklist/    # DailyChecklist, TaskItem, CelebrationToast
    community/    # Leaderboard, MemberCard
    feed/         # Feed, PostCard, PostForm, ReactionBar, CommentSection
  pages/          # Login, Dashboard, MemberDashboard, BeastScoreGuide, Settings
  hooks/          # useAuth, useGoals, useAllGoals, useCompletions, useAllCompletions,
                  # useCalendar, usePosts, usePagedPosts, useUser, useUsers, useVersionPolling
  lib/            # firebase, firestore, time, leaderboard, images, storage, pushNotifications
  contexts/       # ThemeContext (dark/light)
  types/          # index.ts — UserProfile, Goal, Completion, Post, Comment, Reaction, Kudos, DayState
```

---

## Firebase Collections

### `users/{userId}`
```ts
{
  email: string
  displayName: string
  photoURL: string
  joinedAt: Timestamp
}
```

### `goals/{goalId}`
```ts
{
  userId: string
  title: string
  description: string
  frequency: {
    type: 'daily' | 'weekly'
    daysPerWeek: number   // required days per week
    totalDays: number     // June target
  }
  createdAt: Timestamp
  active: boolean
}
```

### `completions/{completionId}`
```ts
{
  goalId: string
  userId: string
  date: string        // "2026-06-15" — always Eastern Time
  completedAt: Timestamp
}
```

### `posts/{postId}`
```ts
{
  userId: string
  imageURLs: string[]   // Cloudinary URLs (rewritten to CDN worker at read time)
  caption: string
  createdAt: Timestamp | null
}
```

### `comments/{commentId}`
```ts
{
  postId: string
  userId: string
  text: string
  createdAt: Timestamp | null
}
```

### `reactions/{reactionId}`
```ts
{
  postId: string
  userId: string
  emoji: string
  createdAt: Timestamp | null
}
```

### `kudos/{kudosId}`
```ts
{
  fromUserId: string
  toUserId: string
  date: string        // "YYYY-MM-DD" ET — the day the recipient completed all tasks
  createdAt: Timestamp | null
}
```

---

## Key Conventions

### Dates are always Eastern Time
Use helpers from `src/lib/time.ts`. Never use `new Date().toISOString()` directly for date strings — it'll be wrong for ET users after 8pm.

```ts
// Good
import { todayET, toETDateString } from '@/lib/time'
const today = todayET() // "2026-06-01"

// Bad
const today = new Date().toISOString().split('T')[0]
```

### Completions are idempotent by (goalId, date)
Before writing a new completion, check if one already exists for that (goalId, date) pair. Don't write duplicates.

### Weekly goals span Sun–Sat
A goal with `frequency.type === 'weekly'` is "due" any time during its Sun–Sat week. On the calendar, it renders as a horizontal bar spanning the full week row. It's "completed for the week" once `completions` for that goalId in that week >= `daysPerWeek`.

### Daily goals reset at midnight ET
A goal with `frequency.type === 'daily'` generates one task per day. It's complete for a given day if a completion for that (goalId, date) exists.

### Past days are frozen
Once a calendar day has passed (midnight ET), its state is locked. Don't allow checking tasks for previous days.

---

## Firestore Security Rules (target)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Any authenticated group member can read everything
    match /{document=**} {
      allow read: if request.auth != null;
    }
    // Users can only write their own goals and completions
    match /goals/{goalId} {
      allow write: if request.auth.uid == resource.data.userId
                   || (request.resource.data.userId == request.auth.uid);
    }
    match /completions/{completionId} {
      allow write: if request.auth.uid == resource.data.userId
                   || (request.resource.data.userId == request.auth.uid);
    }
    match /users/{userId} {
      allow write: if request.auth.uid == userId;
    }
  }
}
```

---

## Auth Flow

1. `Login.tsx` renders a "Sign in with Google" button
2. `signInWithPopup(auth, googleProvider)` completes
3. App shows a group password prompt (not a Firebase feature — just a modal)
4. If password matches `VITE_GROUP_PASSWORD`, store `beast_mode_authed=true` in localStorage and navigate to dashboard
5. On app load, `useAuth` checks both `firebase.auth().currentUser` and `localStorage.beast_mode_authed`
6. If either is missing, redirect to `/login`

The group password is intentionally low-security — it's just to keep the app private from casual visitors.

---

## Celebration Behavior

When a user checks off a task:
1. Write the completion to Firestore
2. Fire `canvas-confetti` with a burst from the checked item's position
3. If this completion finishes all tasks for the day: trigger a larger full-screen confetti burst

---

## Common Tasks for Claude

### "Add a new Firestore field to goals"
1. Update the `Goal` type in `src/types/index.ts`
2. Update the goal creation form in `src/components/goals/GoalForm.tsx`
3. Update the write helper in `src/lib/firestore.ts`
4. Handle the case where old goals are missing the new field (default it)

### "Fix a date/timezone bug"
Always check `src/lib/time.ts` first. The helpers there should be the only place raw `Date` objects are converted to ET strings.

### "Add a new calendar view feature"
The calendar state is derived in `src/hooks/useCalendar.ts`. It takes goals + completions and returns a structured map of `{ [date: string]: DayState }`. Modify the derivation logic there, not in the component.

### "Add a new page/route"
1. Create `src/pages/NewPage.tsx`
2. Add the route in `src/App.tsx`
3. Wrap in `<ProtectedRoute>` if it requires auth

### "Change Beast Score logic"
All scoring math lives in `src/lib/leaderboard.ts`. The `Leaderboard` component in `src/components/community/Leaderboard.tsx` consumes it. The `BeastScoreGuide` page explains the algorithm to users — keep it in sync with any logic changes.

### "Add a new feed feature (reactions, comments, etc.)"
1. Add the type to `src/types/index.ts`
2. Add read/write helpers to `src/lib/firestore.ts`
3. Add a hook in `src/hooks/` if real-time subscription is needed
4. Wire up the component — feed components live in `src/components/feed/`

### "Change image upload behavior"
Image uploads use Cloudinary via `src/lib/storage.ts`. URLs are rewritten at read time in `src/lib/images.ts` to route through the CDN Worker (`VITE_IMAGE_CDN_URL`). Change upload logic in `storage.ts`; change CDN routing in `images.ts`.

### "Seed test data"
Use the Firebase Console → Firestore → "Start collection" to manually add documents, or run `npm run seed` (script in `scripts/seed.ts`) once it exists.

---

## What NOT to Do

- Don't add new features that directly write to Firestore from the client — new features go through the Hono Worker (see migration path below)
- Don't use `moment.js` — use the helpers in `src/lib/time.ts` or native `Intl`
- Don't allow writes to other users' data — always scope writes to `auth.currentUser.uid`
- Don't render calendar days in the future — only render up to today
- Don't allow editing completions for past days

---

## Environment

Copy `.env.example` to `.env.local` and fill in the Firebase config values. All env vars are prefixed `VITE_` so Vite exposes them to the client.

Firebase project setup:
1. Create project at console.firebase.google.com
2. Enable Authentication → Google provider
3. Enable Firestore → start in test mode, then apply the rules above
4. Register a Web App to get the config object
5. Enable Firebase Hosting

---

## Backend Migration Path (Firebase → Hono + Cloudflare)

New features (chat, challenges, difficulty ratings) are being built on a Hono Worker rather than directly in Firestore. Firebase Auth stays permanently; the Worker verifies its ID tokens.

Full step-by-step plans are in `docs/migration/`:
- [`00-overview.md`](docs/migration/00-overview.md) — architecture diagram + feature routing table
- [`01-scaffold-worker.md`](docs/migration/01-scaffold-worker.md) — Hono + wrangler setup
- [`02-auth-middleware.md`](docs/migration/02-auth-middleware.md) — Firebase JWT verification
- [`03-challenges.md`](docs/migration/03-challenges.md) — D1 schema, friend requests, challenges
- [`04-chat.md`](docs/migration/04-chat.md) — Durable Objects, WebSocket rooms
- [`05-difficulty-rating.md`](docs/migration/05-difficulty-rating.md) — Cron Trigger, weekly analysis
- [`06-migrate-data.md`](docs/migration/06-migrate-data.md) — optional Firestore → D1 data migration

When working on any migration step, read the relevant file for full context.
