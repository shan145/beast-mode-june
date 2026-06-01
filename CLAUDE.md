# CLAUDE.md — Beast Mode June

This file helps Claude understand the project so it can give you accurate, context-aware help.

---

## Project Overview

Beast Mode June is a small-group accountability web app for tracking quantifiable June goals. ~10–15 users, all known, no public access. Firebase is the only backend — no server, no API routes.

---

## Tech Stack

- **React 18 + TypeScript** via Vite
- **Tailwind CSS** for all styling
- **Firebase Auth** — Google sign-in only, plus a client-side group password gate (set via `VITE_GROUP_PASSWORD` env var)
- **Firestore** — real-time database, no dedicated backend
- **canvas-confetti** — celebration animations on task completion
- **React Context** for auth state; component-local state for everything else

---

## Project Structure

```
src/
  components/        # Reusable UI components
    ui/              # Generic (Button, Modal, Badge, etc.)
    goals/           # GoalCard, GoalForm, GoalList
    calendar/        # JuneCalendar, DayCell, WeekRow
    checklist/       # DailyChecklist, TaskItem
    community/       # MemberList, MemberView
  pages/             # Route-level components
    Login.tsx
    Dashboard.tsx    # Personal view
    MemberDashboard.tsx  # Read-only view of another user
  hooks/
    useAuth.ts       # Current user + group auth state
    useGoals.ts      # Goals CRUD
    useCompletions.ts# Read/write completions
    useCalendar.ts   # Derive calendar state from goals + completions
  lib/
    firebase.ts      # Firebase app + exports (auth, db)
    firestore.ts     # Typed read/write helpers
    time.ts          # Eastern Time helpers (date strings, resets)
  types/
    index.ts         # Goal, Completion, User types
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

### "Seed test data"
Use the Firebase Console → Firestore → "Start collection" to manually add documents, or run `npm run seed` (script in `scripts/seed.ts`) once it exists.

---

## What NOT to Do

- Don't add a Node.js backend or API routes — everything goes through the Firebase SDK directly
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

## Iteration Plan Summary

| Phase | Focus |
|---|---|
| 1 | Project scaffold, Firebase wiring, auth flow |
| 2 | Goals CRUD (create, edit, delete with warning) |
| 3 | Daily/weekly checklist + completions + confetti |
| 4 | June calendar UI (grid, day cells, weekly bars) |
| 5 | Community view (read-only member dashboards) |
| 6 | Polish, responsive design, production deploy |
