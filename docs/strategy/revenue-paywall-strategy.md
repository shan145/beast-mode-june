# Revenue Modeling & Paywall Strategy

> Status: proposal / discussion doc. No payment code exists yet — this lays out
> the model, pricing, paywall placement, and a phased build plan that fits the
> existing Firebase → Hono/Cloudflare migration path.

---

## 1. TL;DR

- **Beast Mode June today**: a closed, single-group, password-gated app for
  ~10-15 known friends. Free, no payments, no multi-tenancy.
- **The core asset is the group**, not the individual. Accountability/habit
  apps live or die on network effects — gating the basic "track goals with my
  friends" loop kills the thing that makes people invite friends.
- **Recommended model**: freemium **per-user subscription** ("Plus") layered
  on top of a **per-group "Season Pass"** paid by whoever runs the group
  (the organizer), plus an optional **charity-backed commitment stakes**
  feature as a longer-term upside play.
- **Biggest prerequisite that isn't pricing**: the app currently models *one*
  group. Charging different groups money requires multi-tenancy (multiple
  independent "seasons"/groups, each with their own roster, password, and
  billing owner). This is the real unlock — pricing is secondary to it.
- **Realistic near-term revenue**: low — a handful of friend groups paying
  $10-20/season. The model below is built so it scales cleanly if/when more
  groups adopt it, without needing a redesign.

---

## 2. Current State Assessment

| Dimension | Current reality |
|---|---|
| Users | ~10-15, all known to each other, invited manually |
| Access | Single shared `VITE_GROUP_PASSWORD` gate + Google sign-in |
| Tenancy | Single implicit "group" — all users share one Firestore dataset |
| Monetization | None — no Stripe, no entitlements, no tiers |
| Cost base | Firebase (Auth/Firestore, free tier likely sufficient at this scale), Cloudinary (free tier), 3 lightweight CF Workers (free tier) |
| Planned features | Friend requests/challenges (D1), real-time chat (Durable Objects), weekly difficulty ratings (Cron) — see `docs/migration/03-06` |

At current scale, infrastructure cost is approximately **$0/month**. Any
pricing strategy here is about *future* growth, not recouping current spend.

---

## 3. Why Group-Based Monetization, Not Pure Per-Seat SaaS

Standard B2C freemium (cap individual usage, charge the individual) works
poorly for accountability apps because:

1. **The product only works if everyone in the group participates.** If 3 of
   10 friends hit a paywall and quit, the app loses value for the other 7.
2. **One person usually drives adoption** — someone proposes "let's all do
   Beast Mode this month" and recruits the group. That person is the natural
   buyer, not each individual friend.
3. **Comparable products validate this**: Strava keeps social/following free
   and gates *personal analytics*; Habitica gates *cosmetics and guild
   extras*, not the core habit loop; Beeminder and StickK monetize via
   **commitment stakes**, not feature paywalls.

So: **keep the core daily-checklist/calendar/feed/leaderboard loop free for
everyone**, and monetize (a) power-user features for individuals, and (b)
group-level features paid once by an organizer on behalf of the whole group.

---

## 4. Recommended Business Model

### 4.1 Three revenue streams (introduce in this order)

1. **Season Pass (group-level, B2B2C)** — one person pays per group/season,
   unlocking premium features for *all* members of that group. This is the
   primary near-term revenue path because it matches how groups actually form.
2. **Plus (individual subscription)** — optional upgrade for power users who
   want cross-group / cross-season features regardless of which groups they're
   in.
3. **Commitment Pots (transactional, charity-backed)** — later-stage. Users
   stake money on hitting their goals; platform takes a small cut. Framed as
   donations-on-failure to sidestep money-transmission regulation (see §9).

### 4.2 Why this ordering

Season Pass requires the least new individual-level infrastructure (one
Stripe Checkout session per group, one `groups` table), produces the clearest
"who is the buyer" story, and aligns with the **multi-tenancy work you'll need
anyway** if you want more than one friend group to use this app.

---

## 5. Pricing Tiers

### Free — "Beast"
Everything that exists in the app *today*, unchanged:
- Unlimited goals, daily checklist, June calendar
- Feed: posts, images, reactions, comments, kudos
- Leaderboard / Beast Score / member dashboards
- Push notifications
- Join exactly **one** active group/season

> Rationale: this is the entire current product. Don't take anything away
> from existing users — that's how you torch the 10-15 people you need as
> evangelists.

### Plus — $4/month or $20/year (per user)
For individuals who want to run their own accountability practice across
multiple groups or year-round:
- Join **unlimited** groups/seasons simultaneously
- Full historical calendar (past seasons, not just current month)
- Data export (CSV of goals/completions)
- Profile customization (avatar frames, themes — cheap to build, good margin)
- Early access to new features (chat, challenges)

### Season Pass — $15-25 per group, per season (one-time, paid by organizer)
Unlocks for **everyone in that group** for the duration of the season
(e.g., one calendar month, matching the "June" framing):
- **Challenges & friend requests** (already planned — `docs/migration/03-challenges.md`)
- **Real-time group chat** (already planned — `docs/migration/04-chat.md`)
- **Weekly difficulty ratings / AI coaching insights** (already planned —
  `docs/migration/05-difficulty-rating.md`)
- Group analytics dashboard (completion rates, trends across the group)
- Custom group name/branding + custom password (replacing the shared env-var gate)
- Higher-resolution image uploads / increased Cloudinary quota

> Rationale: every "new feature" already on your roadmap is, conveniently,
> exactly the kind of feature that's fun-but-not-essential — perfect paywall
> material that doesn't touch the free core loop. You get to build these
> features once and they double as the premium tier.

### Pricing sanity check vs. comparables
| Product | Model | Price |
|---|---|---|
| Strava | Freemium subscription | $11.99/mo or $79.99/yr |
| Habitica | Freemium subscription | $4.99/mo |
| Beeminder | Subscription + stakes | $8-32/mo + stakes |
| StickK | Free + stakes | Stakes only, ~$0 base |
| **Beast Mode Plus** | Freemium subscription | **$4/mo** |
| **Beast Mode Season Pass** | Per-group, per-season | **$15-25/season** (≈$1-2.50/member for a 10-15 person group) |

The Season Pass framed *per member* is extremely cheap (~the cost of a
coffee for the whole month, split across the group), which is the right
anchor for a friend-group product.

---

## 6. Paywall Placement Map

Concrete mapping to the existing codebase — what stays free, what's gated,
and roughly where the gate would live.

| Feature | Tier | Where it lives today / would live |
|---|---|---|
| Goals CRUD, daily checklist, calendar | Free | `src/components/goals/`, `src/components/checklist/`, `src/components/calendar/` — **no changes** |
| Feed (posts, reactions, comments, kudos) | Free | `src/components/feed/` — **no changes** |
| Leaderboard / Beast Score | Free | `src/components/community/Leaderboard.tsx`, `src/lib/leaderboard.ts` — **no changes**. Keep free: this is your virality engine. |
| Single group membership | Free | New `groups` concept — every user gets exactly one free group slot |
| Multiple concurrent groups | **Plus** | Gate in `useGoals`/`useAllGoals` (or whatever loads group membership) — check `entitlements.maxGroups` |
| Full history / past seasons | **Plus** | Gate in `useCalendar.ts` — limit date range queried for free users |
| CSV export, profile cosmetics | **Plus** | New, additive — no existing code to retrofit |
| Friend requests & challenges | **Season Pass** | `docs/migration/03-challenges.md` — gate at the Hono middleware layer (entitlement check before D1 write) |
| Real-time chat | **Season Pass** | `docs/migration/04-chat.md` — gate Durable Object room creation/join on group entitlement |
| Difficulty ratings / AI insights | **Season Pass** | `docs/migration/05-difficulty-rating.md` — Cron job only writes `difficulty_scores` for entitled groups |
| Group branding / custom password | **Season Pass** | Replaces the global `VITE_GROUP_PASSWORD` — per-group password stored server-side |

**Key principle**: every paywalled item above is either (a) a feature that
doesn't exist yet, or (b) a multi-group/historical-data feature that doesn't
remove anything from the current 10-15 users. Nobody currently using the app
loses access to anything.

---

## 7. Commitment Pots (Phase 3 — later)

A "put your money where your mouth is" feature fits this product extremely
well (it's literally what "Beast Mode" implies) and has precedent (StickK,
Beeminder).

**Recommended safe design**:
- At season start, a user can optionally pledge $X to a shared pot.
- At season end, if they hit their goal threshold, the pledge is **refunded**.
- If they miss, the pledge is **donated to a charity** the group selects up
  front (not redistributed to other users, and never kept as platform
  revenue beyond a small processing fee).
- Platform takes a flat **2-3% processing fee** on pledged amounts to cover
  Stripe fees + margin.

This avoids the regulatory complexity of money transmission (no
user-to-user payouts), since funds either return to the original payer or go
to a registered charity. Treat as Phase 3 — needs Stripe Connect/Checkout,
legal review of charity payout flow, and is independent of the
subscription/Season Pass infrastructure.

---

## 8. Revenue Projections

These are **directional**, not forecasts — useful for deciding whether to
invest engineering time, not for a pitch deck. Three scenarios based on
number of *groups* using the app (each group ~10-15 people, mirroring the
current group's size), assuming Season Pass adoption only at first (Plus and
Pots layered in later).

| Scenario | Active groups | Season Pass adoption | Avg price | Monthly revenue* | Annual revenue |
|---|---|---|---|---|---|
| **Conservative** (a few friend groups copy the idea) | 5 | 60% | $20/season | $20 (5 × 0.6 × $20 / 3mo amortized) | ~$240 |
| **Moderate** (organic spread within a social circle / campus) | 50 | 50% | $20/season | $333 | ~$4,000 |
| **Optimistic** (some viral pickup, e.g. shared on social/Reddit) | 500 | 40% | $20/season | $2,667 | ~$32,000 |

\* Assumes ~3 seasons/year per group (e.g., quarterly challenges rather than
just June), revenue spread monthly.

**Adding Plus subscriptions** (assume 5% of individual users convert at
$4/mo, ~12 users/group):

| Scenario | Total users | Plus converts (5%) | Monthly Plus revenue | Combined monthly |
|---|---|---|---|---|
| Conservative | 60 | 3 | $12 | ~$32 |
| Moderate | 600 | 30 | $120 | ~$453 |
| Optimistic | 6,000 | 300 | $1,200 | ~$3,867 |

**Bottom line**: at the scale described in this repo (10-15 users, one
group), there is essentially **no revenue case** — and that's fine. The
value of building this now is that the *next* feature you build anyway
(challenges, chat, difficulty ratings) becomes the premium tier for free,
and the architecture supports growth if other groups want in. Don't
over-invest in billing infrastructure before there's a second group asking
to pay.

---

## 9. Phased Implementation Plan

### Phase 0 (prerequisite, do this regardless of monetization)
**Multi-tenancy**: introduce a `groups`/`seasons` concept so the app can host
more than one independent friend group. This is the actual hard part — it
touches `useAuth`, the group password gate, and every Firestore query that
currently assumes "all users" = "my group". This should land *before* any
billing work, and is valuable even if you never charge anyone (e.g., to let a
sibling group of friends use the same deployment without seeing your data).

### Phase 1 — Season Pass (smallest billing surface)
- Add Stripe Checkout (one-time payment) in `workers/api/` (Hono)
- New D1 table: `season_passes (group_id, purchased_by, expires_at, stripe_session_id)`
- Auth middleware (`02-auth-middleware.md`) gains an entitlement check:
  `hasSeasonPass(groupId): boolean`
- Gate the three planned features (challenges, chat, difficulty ratings) on
  this check as you build them — no retrofitting needed since they're not
  built yet
- Frontend: simple "Upgrade this group" button + Stripe redirect, visible to
  the group's designated organizer

### Phase 2 — Plus subscriptions
- Stripe Subscriptions (recurring) via Hono Worker
- D1 table: `subscriptions (user_id, tier, stripe_customer_id, status, current_period_end)`
- Gate multi-group membership and historical calendar views on `tier === 'plus'`

### Phase 3 — Commitment Pots
- Stripe Checkout for pledges + Stripe-managed payouts to charities
  (no user-to-user transfers)
- New D1 tables: `pots`, `pledges`, `payouts`
- Cron job (reuses the existing difficulty-rating cron infra) to settle pots
  at season end

---

## 10. Go-to-Market Notes

- **Don't rebrand away from "June" prematurely** — the time-boxed,
  seasonal framing ("this June, we're all doing Beast Mode") is a strong
  growth mechanic (urgency + cohort start dates). If multi-tenancy lands,
  consider supporting **recurring seasons** (e.g., "July Beast Mode",
  "New Year Beast Mode") rather than a generic always-on tracker.
- **Referral loop**: since the organizer is the buyer, give them an incentive
  to recruit — e.g., Season Pass price scales down per-member as the group
  grows ($25 flat for ≤10 members, $35 flat for ≤25 members), so organizers
  are incentivized to invite more friends.
- **Free tier must stay genuinely complete.** The current feature set (goals,
  calendar, feed, leaderboard) is the whole value prop for new groups
  evaluating the app — none of it should ever move behind a paywall.

---

## 11. Open Questions for Discussion

1. Is there actual demand from outside the current 10-15 person group, or is
   this exploratory? (Affects how much Phase 0 multi-tenancy work is
   justified right now.)
2. Who would be the "organizer" persona in practice — is there always a
   natural single payer per group?
3. Appetite for handling money at all (even charity-only pots) given the
   compliance overhead, vs. keeping monetization to subscriptions only?
4. Should "Plus" cosmetics/customization be built before or after the
   Season Pass features, given cosmetics are pure margin but don't map to
   anything on the current roadmap?
