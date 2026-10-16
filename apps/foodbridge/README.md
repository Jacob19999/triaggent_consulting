# FoodBridge (hosted app)

One app for The Food Group network, with three areas:

| Area | Who | What it does |
| --- | --- | --- |
| **Manager workspace** (`/manager`) | Operations and allocation staff | Command center · executive **Food Access Equity Index (FEI)** overview (county and tract) · **map explorer** (basemap, county or tract FEI, pillars, access, need and forecast layers, LILA and audit-county overlays, tract breakdown with pillar bars and radar) · **site planner** (place a site or search every tract for the best five; each is sized from the August forecast and scored on reach, FEI change and dollars) · **supply allocation** (visits-vs-need blend with map, pool split and per-county bars) · shelf priorities with manager overrides · alert center · requests inbox · **AI policy and operations briefing** |
| **Food shelf portal** (`/shelf`) | Shelf coordinators | Monthly report in the network's own fields (`HouseholdsReg`, `IndividualsReg`, age split, `PoundsReg`) plus stock and turn-aways · next-month forecast with an 80%/95% band · stock-out, capacity, demand and reporting alerts · requests to the food bank · assistant |
| **Findings** (`/findings`) | Presenting to judges, funders and staff | Central finding and the six scored answers with their numbers · in-app slides · the deck and handout PDFs · technical details · every source with its SHA-256 |

It complements the local, offline FoodBridge in `dashboard/web/` (D-038), which stays the
offline backup. This app adds shared accounts, shelf reporting and hosting.

## Run locally

```bash
cd apps/foodbridge
npm install
npm run dev            # http://localhost:3000
```

With no environment variables the **demo workspace** works end to end: 14 synthetic
"Demo shelf" records live in the browser (scaled from county averages, not site data).
Copy `.env.example` to `.env.local` to enable the live workspace and the AI agent.

For temporary prototype access, set `FOODBRIDGE_EMAIL_ONLY_LOGIN=true` in
`.env.local` or the deployment environment. Entering an email at `/login` creates the
account if needed and signs in
immediately, without a password, inbox link or approval step. New and pending accounts
receive manager access; existing shelf accounts keep their role. This mode treats the
email as an account selector and does not verify ownership. Requests must come from
the app's own origin. The mode is off unless explicitly enabled. Remove the setting to
restore emailed sign-in links and manager approval for new accounts.

Checks:

```bash
npm run check          # typecheck + vitest + privacy scan
npm run build
```

## Refresh the research data

The app reads `data/research.json` and `public/data/fei-tracts.json`. Both are generated,
committed, and contain county and tract aggregates only. Rebuild from the repository root:

```bash
uv run python -m mi.foodbridge_bundle
```

Options: `--geo <map_payload.json>` (county and tract outlines; built by `make geo`),
`--sram <sram2025_mn.csv>` (tract urban flags), and `--fei-tables <dir> --fei-meta <dir>`
for the FEI build when it lives elsewhere, e.g. the A4 worktree before its branch merges:

```bash
uv run python -m mi.foodbridge_bundle \
  --fei-tables ../astra-a4-fei/outputs/tables --fei-meta ../astra-a4-fei/outputs/fei
```

The exporter selects columns one by one, never copies site rows, `site_key`, `block_geoid`,
per-tract shelf counts or Map the Meal Gap county values, guards the observed history
against August 2026, and fails if its privacy scan finds a forbidden field or a local
path. When `fei_counties.csv` is absent, FEI shows as pending and the maps fall back to
the Q6 need percentile, labelled as a placeholder (FoodBridge never computes its own FEI).

## Deploy on Vercel

1. Use the existing `jacob19999s-projects/foodbridge` project, built from `Jacob19999/triaggent_consulting`. Never deploy the private research repository (D-061).
2. **Root Directory:** `apps/foodbridge`. Framework preset: Next.js. Node 20 or later.
3. **Environment variables** (Production and Preview):

   | Variable | Needed for | Exposed to browser |
   | --- | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Live workspace | yes (public) |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Live workspace (RLS applies) | yes (public) |
   | `SUPABASE_SECRET_KEY` | Granting shelf access (`/api/admin/invite`) | **no, server only** |
   | `FOODBRIDGE_EMAIL_ONLY_LOGIN` | Optional `true`: immediate prototype sign-in and manager access for new accounts | no |
   | `GEMINI_API_KEY` | AI briefing (`/api/agent`); offline briefing without it | **no, server only** |
   | `FOODBRIDGE_AI_MODEL` | Optional, default `gemini-flash-latest` | no |
   | `FOODBRIDGE_AI_REQUIRE_AUTH` | Optional `true`: only signed-in users may call the agent | no |
   | `FOODBRIDGE_AI_PER_IP`, `FOODBRIDGE_AI_DAILY_LIMIT` | Optional limits (default 8 per 10 min, 300 per day) | no |
   | `NEXT_PUBLIC_FOODBRIDGE_MODE` | Optional `demo`: hide the live workspace | yes |
   | `FOODBRIDGE_ALLOW_INDEXING` | Optional `true`: allow search indexing (off by default) | no |

4. Deploy. `/api/health` reports the bundle version, AI provider/model, and which services are configured. Gemini uses the direct Google `generateContent` API with read-only function calls. When the default Flash alias returns HTTP 503, the conversation restarts once on `gemini-flash-lite-latest`, and the summary identifies the fallback model; quota, overload, timeout, or missing-key failures return the sourced offline briefing. Free-tier quotas are controlled by Google and are not guaranteed by this app. Keep `GEMINI_API_KEY` server-only (a Vercel Secret), never in a `NEXT_PUBLIC_` variable.

Deploying is publishing (CLAUDE.md): the URL is public unless you turn on Vercel
Deployment Protection. Pages send `noindex` by default.

## Set up Supabase (live workspace)

1. Create a project. In **SQL Editor**, run `supabase/migrations/0001_foodbridge.sql`.
   It creates `profiles`, `shelves`, `shelf_reports`, `shelf_requests`, `alert_states` and
   `scenarios` with row-level security: managers see the network; a shelf user sees and
   edits only its own shelf and cannot change its priority or manager note.
2. **Authentication → URL configuration:** Site URL = your Vercel URL; add
   `https://<your-app>/auth/callback` and `http://localhost:3000/auth/callback` as redirect URLs.
3. Sign in once at `/login`, then promote yourself:
   `update public.profiles set role = 'manager' where email = 'you@example.org';`
   New sign-ins stay `pending` (they see nothing) until a manager assigns a role; roles are
   never read from sign-up metadata.
4. Manager → **Shelves & priorities** → Add a shelf → **Give a shelf coordinator access**
   (creates the account server-side and links it to the shelf). The coordinator signs in
   at `/login` with that email.
5. Optional: **Load demo shelves** on the same page copies the labelled synthetic network
   into the live workspace for training or a presentation; **Remove demo shelves** deletes it.
6. Verify the schema against the app's real payloads (reads `.env.local`; inserts one labelled
   shelf with its reports, checks constraints and row-level security, then deletes it):

   ```bash
   SUPABASE_INTEGRATION=1 npx vitest run tests/supabase.integration.test.ts
   ```

Supabase holds app state only. Sponsor microdata, site-level extracts and licensed Map the
Meal Gap tables never go there.

## Tools

| Tool | Status | Why |
| --- | --- | --- |
| Vercel | Required for hosting | Next.js app and API routes |
| Supabase | Required for the live workspace | Postgres, magic-link auth, row-level security |
| Google Gemini API | Optional | AI briefing; without a key the agent returns an offline, fact-only briefing |
| Upstash Redis or Vercel KV | Recommended for a public URL | Durable rate limits on `/api/agent` (built-in limits are per instance) |
| Resend + Vercel Cron | Optional | Email alert digests to shelves |
| Sentry or Vercel Observability | Optional | Error monitoring |

## How the numbers are made

- **County forecast (August 2026):** the submitted Q7 model (D-045), labelled as an internal
  forecast, never an actual.
- **Shelf forecast:** the same 1:2:3 working-day run rate on the shelf's own reports, with
  bands from its one-step backtest errors (six or more), otherwise ±20% / ±35%.
- **Alerts:** deterministic rules in `src/lib/alerts.ts`; each shows its numbers, field and
  next step. Forecast alerts say "may".
- **Priority score:** weighted sum of equity, stock risk, demand growth, capacity strain and
  reporting gap (weights adjustable; overrides sort first). It never moves food on its own.
- **New-shelf scenario:** residents at tract centroids; straight-line distance to the nearest
  *reporting* shelf (D-051); USDA 1-mile urban / 10-mile rural thresholds. FEI change follows
  the FEI build: the new site's 2SFCA ratio is added to tract access, S and T are re-normalized
  with the build's published bounds (a test checks the recomputation matches the published
  pillars). Labelled "approximation from tract averages". Dollar assumptions are editable and
  marked cited, example or placeholder.
- **New-site forecast (site planner, `src/lib/siteModel.ts`):** for each tract whose nearest
  reporting shelf would become the new site, shifted visits = residents × the county's August 2026
  forecast visits per resident (D-045) × a Huff gravity share (distance exponent 2) × the site
  type's reach (planning assumption: mobile 50%, outreach 40%, campus 35%). Induced visits add
  e^(k × miles saved) − 1, capped at +50%, where k is fitted in the app from the cross-county
  association between distance and 2024 visits per low-income resident (about −11% per mile; an
  association, not causal). Pounds, individuals and ages follow the county's forecast ratios;
  the planning range uses the county's 80% band and ±50% on the induced part. Manual sizes
  override the forecast.
- **Dollar value:** gross value = all food at the site × $/lb; net new value = food for induced
  visits only + round-trip miles saved per visit × the IRS rate. Both are compared with the
  annual cost (operating + start-up spread). Estimates for comparing options, not measured impact.
- **Optimal sites:** every tract centroid more than half a mile from a reporting shelf (statewide,
  one county, or the top-FEI-quintile counties) is scored with the same engine on one objective:
  statewide FEI reduction, residents leaving the top FEI quintile, residents newly within reach,
  low-income residents reached, or net new value. The best five are kept at a minimum spacing.
  Statewide search takes about one second in the browser.
- **Supply allocation:** unchanged formula (D-048, default 0% need). The page also shows what a
  visits-only and a need-only split would give each county, the pool composition, a map of draft
  pounds per resident in poverty, and the draft as a share of the August forecast.
- **AI agent:** server-side tool use. Tools only retrieve (policy timeline, county profiles,
  findings, FEI method, the caller's own alerts). The system prompt forbids computing numbers,
  requires a source after each figure, and applies D-052 and D-053 wording.

## Limits

Distances are straight lines to reporting shelves only; non-reporting shelves, meal programs
and grocers are not in the network. FEI is a screening index, not a count of unmet people and
not causal. The research snapshot ends July 2026. Demo shelves are synthetic.

Maps draw on Esri basemap tiles (Dark/Light Gray Canvas, Streets, Imagery) from
`server.arcgisonline.com`, allowed in the CSP `img-src`. CARTO's free tiles now return an
"API key required" image, so they are not used. Esri's terms expect an ArcGIS account for
production use: before a public or long-lived deployment, add an ArcGIS Location Platform key
or switch the tile URLs in `src/components/map/LeafletMap.tsx`. Without tiles (offline), maps still
draw their county and tract colors on a plain background.
