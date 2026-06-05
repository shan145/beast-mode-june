# Beast Mode June

A shared accountability app for tracking quantifiable goals. Built for a small group to stay motivated, check in on each other's progress, and celebrate wins together.

---

## What It Does

Each member of the group can:

- Sign in with their Gmail account (+ group password gate)
- Create quantifiable goals (e.g. "Run 5 days/week", "Gym 3x/week")
- See a daily/weekly checklist of what needs to get done today
- View a June calendar showing completed vs. missed tasks per day
- Browse other members' dashboards in read-only mode for accountability
- Get a celebration animation when they complete a task

---

## Tech Stack

### Current (client → Firebase)

| Layer | Choice |
|---|---|
| Framework | React 18 + TypeScript (via Vite) |
| Styling | Tailwind CSS |
| Auth | Firebase Auth — Google sign-in + client-side group password gate |
| Database | Firestore — real-time, no backend |
| Hosting | Firebase Hosting |
| Animations | `canvas-confetti` |
| State | React Context + component-local hooks |

All reads and writes go directly from the React client to Firestore. Security rules enforce that users can only write their own data.

### Planned backend (Cloudflare Workers)

New features — real-time chat, user challenges, and smart difficulty ratings — will be built on a Hono API backed by Cloudflare infrastructure. Firebase Auth stays as the identity layer; the Worker verifies Firebase ID tokens on every request.

| Layer | Choice |
|---|---|
| API framework | Hono on Cloudflare Workers (`workers/api/`) |
| Persistent data | Cloudflare D1 (SQLite) |
| Real-time / WebSockets | Cloudflare Durable Objects |
| Scheduled jobs | Cloudflare Cron Triggers |

See `docs/migration/` for the step-by-step plan.

---

## Project Structure

```
src/
  components/
    ui/              # Generic components (Button, Modal, Badge, etc.)
    goals/           # GoalCard, GoalForm, GoalList
    calendar/        # JuneCalendar, DayCell, WeekRow
    checklist/       # DailyChecklist, TaskItem
    community/       # MemberList, MemberView
  pages/
    Login.tsx
    Dashboard.tsx         # Personal view
    MemberDashboard.tsx   # Read-only view of another user
  hooks/
    useAuth.ts            # Current user + group auth state
    useGoals.ts           # Goals CRUD
    useCompletions.ts     # Read/write completions
    useCalendar.ts        # Derives calendar state from goals + completions
  lib/
    firebase.ts           # Firebase app init + exports
    firestore.ts          # Typed Firestore read/write helpers
    time.ts               # Eastern Time helpers
  types/
    index.ts              # Goal, Completion, User types
```

---

## Firebase Data Model

```
users/{userId}
  email: string
  displayName: string
  photoURL: string
  joinedAt: Timestamp

goals/{goalId}
  userId: string
  title: string
  description: string
  frequency:
    type: "daily" | "weekly"
    daysPerWeek: number     // required completions per week
    totalDays: number       // June target
  createdAt: Timestamp
  active: boolean

completions/{completionId}
  goalId: string
  userId: string
  date: string              // "YYYY-MM-DD" in Eastern Time
  completedAt: Timestamp
```

---

## Authentication Flow

1. User clicks "Sign in with Google"
2. After OAuth, app prompts for the group password (`VITE_GROUP_PASSWORD` in `.env.local`)
3. Password checked client-side; stored in `localStorage` on success so you only enter it once per device

> This is a soft gate — it keeps randos out, not determined adversaries.

---

## Local Development

```bash
npm install
cp .env.example .env.local   # fill in Firebase config + group password
npm run dev
```

### Environment Variables

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_GROUP_PASSWORD=
```

---

## Deploying

```bash
npm run build
firebase deploy
```

Ensure `firebase.json` targets the `dist/` folder (Vite's output).
