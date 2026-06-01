# Beast Mode June 🏆

A shared accountability app for tracking quantifiable goals throughout June. Built for a small group (~10–15 people) to stay motivated, check in on each other's progress, and celebrate wins together.

---

## What It Does

**Beast Mode June** is a Firebase-backed web app where each member of our group can:

- Log in with their Gmail account (+ group password gate)
- Create quantifiable goals (e.g. "Run 5 days/week", "Gym 3x/week max 5x")
- See a daily/weekly checklist of what needs to get done
- View a June calendar showing completed vs. missed tasks per day
- Browse other members' dashboards in read-only mode for accountability
- Get a celebration when they complete a task

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | React 18 + TypeScript | Strong typing, fast iteration |
| Build Tool | Vite | Fast dev server, simple config |
| Styling | Tailwind CSS | Utility-first, clean UI fast |
| Auth | Firebase Auth (Google) | Free, easy Gmail sign-in |
| Database | Firebase Firestore | Real-time, no backend needed |
| Hosting | Firebase Hosting | Free tier, trivial deploy |
| Celebrations | `canvas-confetti` | Lightweight, fun |
| State | React Context + hooks | No extra deps for this scale |

No dedicated backend. All reads/writes go directly from the client to Firestore using security rules for access control.

---

## Firebase Data Model

```
users/
  {userId}/
    email: string
    displayName: string
    photoURL: string
    joinedAt: timestamp

goals/
  {goalId}/
    userId: string
    title: string
    description: string
    frequency:
      type: "daily" | "weekly"
      daysPerWeek: number        // how many days per week this must happen
      totalDays: number          // target total days for June
    createdAt: timestamp
    active: boolean

completions/
  {completionId}/
    goalId: string
    userId: string
    date: string                 // "YYYY-MM-DD" in Eastern Time
    completedAt: timestamp
```

Firestore security rules:
- Users can only write their own `goals` and `completions`
- All authenticated group members can **read** any user's data

---

## Authentication Flow

1. User clicks "Sign in with Google"
2. After OAuth success, app prompts for the **group password** (set via `VITE_GROUP_PASSWORD` in your `.env.local`)
3. Password is checked client-side; if wrong, user is signed out
4. On subsequent visits, password is stored in `localStorage` so you only enter it once per device

> Note: This is a soft gate — it keeps randos out, not determined adversaries. Fine for a small friend group.

---

## Feature Breakdown & Iteration Plan

### Phase 1 — Auth & Shell
- [ ] Vite + React + Tailwind project setup
- [ ] Firebase project + config (Auth, Firestore, Hosting)
- [ ] Google sign-in flow with group password gate
- [ ] Protected route wrapper

### Phase 2 — Goals CRUD
- [ ] Goal creation form (title, freq type, days/week, max/week, total days)
- [ ] Goal list on dashboard
- [ ] Edit goal (in-place or modal)
- [ ] Delete goal with confirmation warning ("All saved progress on this goal will be lost")

### Phase 3 — Daily Checklist
- [ ] Derive "today's tasks" from goals + completions
- [ ] Daily tasks reset at midnight Eastern Time
- [ ] Weekly tasks span Sun–Sat, available all week
- [ ] Check off a task → write completion to Firestore
- [ ] Celebration animation on check-off (confetti)

### Phase 4 — June Calendar
- [ ] Monthly grid for June (Sun–Sat layout)
- [ ] Only render days up to today
- [ ] Past days: show completed ✓ or missed ✗ per goal
- [ ] Today: show pending tasks
- [ ] Weekly goals stretch across the full week row
- [ ] Visual key (color-coded per goal or status)

### Phase 5 — Community View
- [ ] Member list sidebar/nav (read from `users` collection)
- [ ] Clicking a member shows their read-only dashboard + calendar
- [ ] Your own profile is highlighted

### Phase 6 — Polish & Deploy
- [ ] Responsive mobile layout
- [ ] Loading states + empty states
- [ ] Firebase Hosting deploy
- [ ] `firestore.rules` + `firestore.indexes.json` committed

---

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Copy env template and fill in your Firebase config
cp .env.example .env.local

# 3. Start dev server
npm run dev
```

### Environment Variables (`.env.local`)

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_GROUP_PASSWORD=
```

Get these from [Firebase Console](https://console.firebase.google.com) → Project Settings → Your Apps.

---

## Deploying

```bash
npm run build
firebase deploy
```

Make sure `firebase.json` targets the `dist/` folder (Vite's output).

---

## Seeding Data

For initial testing, you can inject data directly into Firestore from the Firebase Console or using the seed script:

```bash
# Coming in Phase 2
npm run seed
```

---

## Contributing

This is a small group project. If you're adding a feature:

1. Pull latest from `main`
2. Create a branch: `feature/your-feature`
3. Use Claude (`CLAUDE.md` has context) to help implement
4. Test locally, then open a PR

See `CLAUDE.md` for Claude-specific guidance on working in this codebase.
