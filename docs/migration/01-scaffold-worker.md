# Step 1: Scaffold the Worker

## What to build

A new `workers/api/` directory inside the existing repo. It is a separate Cloudflare Worker project with Hono as the HTTP framework. Deploy a health check endpoint to confirm the Worker is live before building any real routes.

## Directory layout

```
workers/
  images/             # existing image CDN worker
  notifications/      # existing push notifications worker
  api/                # new Hono API worker
    src/
      index.ts        # Hono app entry point
    wrangler.toml     # Cloudflare Worker config
    package.json
    tsconfig.json
```

## Steps

1. Create `workers/api/` directory and initialize a new package:
   ```bash
   cd workers/api
   npm init -y
   npm install hono
   npm install -D wrangler typescript @cloudflare/workers-types
   ```

2. `workers/api/wrangler.toml`:
   ```toml
   name = "beast-mode-api"
   main = "src/index.ts"
   compatibility_date = "2025-01-01"

   [[d1_databases]]
   binding = "DB"
   database_name = "beast-mode-db"
   database_id = ""   # fill in after: wrangler d1 create beast-mode-db

   [[durable_objects.bindings]]
   name = "CHAT_ROOM"
   class_name = "ChatRoom"
   ```

3. `workers/api/src/index.ts` — health check only at this stage:
   ```ts
   import { Hono } from 'hono'
   import { cors } from 'hono/cors'

   const app = new Hono()

   app.use('*', cors({ origin: ['http://localhost:5173', 'https://your-firebase-hosting-url'] }))

   app.get('/health', (c) => c.json({ ok: true }))

   export default app
   ```

4. Create the D1 database:
   ```bash
   wrangler d1 create beast-mode-db
   # copy the database_id into wrangler.toml
   ```

5. Deploy and verify:
   ```bash
   wrangler deploy
   curl https://beast-mode-api.<your-subdomain>.workers.dev/health
   # → {"ok":true}
   ```

## Done when

- Worker deploys without errors
- `/health` returns `{"ok":true}` from the deployed URL
- `database_id` is filled in `wrangler.toml` and committed

## Next

[Step 2 — Auth middleware](./02-auth-middleware.md)
