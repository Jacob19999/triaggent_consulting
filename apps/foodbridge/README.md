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

**Portal password.** Every page, API route, `/data` file, deck PDF and app chunk sits
behind one password (`FOODBRIDGE_PORTAL_PASSWORD`, checked in `src/middleware.ts`; the
form is the plain-HTML `/gate` route). The browser keeps an HttpOnly cookie holding a
SHA-256 of the password for 7 days; **Lock portal** in the sidebar clears it, and changing
the password signs everyone out. If the variable is unset the portal refuses every request
(503), so a deployment never opens by accident. Set it in `.env.local` before `npm run dev`.

Without Supabase the **county networks workspace** works end to end: 86 records, one per
county with a reporting shelf ("Aitkin County network"), each month the sum over that
county's reporting sites in the statewide extract (`food_shelf_broad`, the repaired Q7
training panel, January 2022 to July 2026). They are real sponsor aggregates at county
grain, not individual shelves: the extract carries no shelf names, and the hosted rules
forbid site rows. Stock, receipts, capacity, turn-aways and volunteer hours are not in the
extract and stay blank, so stock and capacity alerts cannot fire on them. Each network's
1:2:3 run rate reproduces the submitted county forecast (a test checks this). Copy
`.env.example` to `.env.local` to enable the live workspace and the AI agent.

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

The app reads `data/research.json`, `public/data/fei-tracts.json` and
`public/data/networks.json`. All are generated, committed, and contain county and tract
aggregates only. Rebuild from the repository root:

```bash
uv run python -m mi.county_networks   # outputs/tables/county_network_month.csv
uv run python -m mi.foodbridge_bundle
```

When this checkout lacks the FEI tables, a full rebuild would mark FEI pending. Refresh
only the county networks (and their row in the source list) with
`uv run python -m mi.foodbridge_bundle --networks-only`. A new network table changes its
SHA-256, which starts browsers on a fresh copy instead of their saved one.

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
   | `FOODBRIDGE_PORTAL_PASSWORD` | **Required.** Portal password; unset = every request refused | no |
   | `NEXT_PUBLIC_SUPABASE_URL` | Live workspace | yes (public) |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Live workspace (RLS applies) | yes (public) |
   | `SUPABASE_SECRET_KEY` | Granting shelf access (`/api/admin/invite`) | **no, server only** |
   | `FOODBRIDGE_EMAIL_ONLY_LOGIN` | Optional `true`: immediate prototype sign-in and manager access for new accounts | no |
   | `GEMINI_API_KEY` | AI briefing (`/api/agent`); offline briefing without it | **no, server only** |
   | `FOODBRIDGE_AI_MODEL` | Optional, default `gemini-3.5-flash-lite`. The alias `gemini-flash-latest` is remapped to this default | no |
   | `FOODBRIDGE_AI_REQUIRE_AUTH` | Optional `true`: only signed-in users may call the agent | no |
   | `FOODBRIDGE_AI_PER_IP`, `FOODBRIDGE_AI_DAILY_LIMIT` | Optional limits (default 8 per 10 min, 300 per day) | no |
   | `NEXT_PUBLIC_FOODBRIDGE_MODE` | Optional `demo`: hide the live workspace | yes |
   | `FOODBRIDGE_ALLOW_INDEXING` | Optional `true`: allow search indexing (off by default) | no |

4. Deploy. `/api/health` reports the bundle version, AI provider/model, and which services are configured. Gemini uses the direct Google `generateContent` API with read-only function calls. The default model is Gemini 3.5 Flash Lite (`gemini-3.5-flash-lite`). The alias `gemini-flash-latest` currently serves Gemini 3.8 Flash, whose tool turns take about 30 seconds and are aborted into the offline briefing, so that alias is remapped to Flash Lite. A different pinned model that returns HTTP 503 or times out is retried once on Flash Lite, and the summary identifies that fallback; quota or other provider failures return the sourced offline briefing. Free-tier quotas are controlled by Google and are not guaranteed by this app. Keep `GEMINI_API_KEY` server-only (a Vercel Secret), never in a `NEXT_PUBLIC_` variable.

Deploying is publishing (CLAUDE.md). The portal password keeps casual visitors and
crawlers out; it is not access control for sensitive data, so the bundle still carries
county and tract aggregates only. Pages send `noindex` by default.

## Set up Supabase (live workspace)

1. Create a project. In **SQL Editor**, run `supabase/migrations/0001_foodbridge.sql`,
   then `supabase/migrations/0002_briefs.sql`. The first creates `profiles`, `shelves`,
   `shelf_reports`, `shelf_requests`, `alert_states` and `scenarios` with row-level security:
   managers see the network; a shelf user sees and edits only its own shelf and cannot change
   its priority or manager note. The second stores generated briefings so every manager and
   shelf account can read them. An existing project only needs `0002_briefs.sql`.
2. **Authentication → URL configuration:** Site URL = your Vercel URL; add
   `https://<your-app>/auth/callback` and `http://localhost:3000/auth/callback` as redirect URLs.
3. Sign in once at `/login`, then promote yourself:
   `update public.profiles set role = 'manager' where email = 'you@example.org';`
   New sign-ins stay `pending` (they see nothing) until a manager assigns a role; roles are
   never read from sign-up metadata.
4. Manager → **Shelves & priorities** → Add a shelf → **Give a shelf coordinator access**
   (creates the account server-side and links it to the shelf). The coordinator signs in
   at `/login` with that email.
5. Optional: **Load county networks** on the same page copies the 86 labelled county
   networks into the live workspace for training or a presentation; **Remove county
   networks** deletes them (rows flagged `is_demo`).
6. Verify the schema against the app's real payloads (reads `.env.local`; inserts one labelled
   county network with its reports, checks constraints and row-level security, then deletes it):

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
  bands from its earlier one-step errors (six or more), otherwise assumed ±20% / ±35%.
  Errors and band application share the same prediction scale, including reported zeros.
  These are empirical planning ranges, not calibrated coverage guarantees.
- **Alerts:** deterministic rules in `src/lib/alerts.ts`; each shows its numbers, field and
  next step. Forecast alerts say "may".
- **Priority score:** weighted sum of equity, stock risk, demand growth, capacity strain and
  reporting gap (weights adjustable; overrides sort first). It never moves food on its own.
- **New-shelf scenario:** residents at tract centroids; straight-line distance to the nearest
  *reporting* shelf (D-051); USDA 1-mile urban / 10-mile rural thresholds. FEI change follows
  the FEI build: only additional network food enters the new 2SFCA supply ratio; S and T are re-normalized
  with the build's published bounds (a test checks the recomputation matches the published
  pillars). Labelled "approximation from tract averages". Dollar assumptions are editable and
  marked cited, example or placeholder.
- **New-site activity scenario (`src/lib/siteModel.ts`, D-070):** shifted visits use tract
  population × county forecast visits per resident × Huff share (distance exponent 2) × the
  site type's assumed reach. Additional visits and the share of food added to the network are
  explicit sensitivity controls, both default zero. County associations do not estimate a
  site's causal uplift. Pounds, individuals and ages follow county forecast ratios; manual
  sizes also apply during ranking. Activity ranges are illustrative, not validated site intervals.
- **Dollar value:** avoided travel applies only to shifted visits; additional visits add travel
  costs. Additional food value is limited by both assumed new-visit food and additional
  network supply. Costs remain editable placeholders. Redistribution losses are not modeled.
- **Optimal sites:** every tract centroid more than half a mile from a reporting shelf (statewide,
  one county, or the top-FEI-quintile counties) is scored with the same engine on one objective:
  statewide FEI reduction, residents leaving the top FEI quintile, residents newly within reach,
  low-income residents reached, or net new value. The best five are kept at a minimum spacing.
  These are one-site alternatives, not a joint expansion plan. Changing assumptions clears
  old ranks; missing FEI data produces an error rather than silently changing the objective.
- **Supply allocation:** unchanged formula (D-048, default 0% need). The page also shows what a
  forecast-pounds-only and a need-only split would give each county, the pool composition, a map of draft
  pounds per resident in poverty, and the draft as a share of the August forecast. Both the
  draft and comparison conserve the available pool using largest remainders. All eligible
  counties are selected initially; the Q6 review list is explicitly not an allocation mandate.
  Saved drafts can be reopened; saving and error states are visible.
- **AI agent:** server-side tool use. Tools only retrieve (policy timeline, county profiles,
  findings, FEI method, the caller's own alerts). The system prompt forbids computing numbers,
  requires a source after each figure, and applies D-052 and D-053 wording.

## Limits

Distances are straight lines to reporting shelves only; non-reporting shelves, meal programs
and grocers are not in the network. FEI is a screening index, not a count of unmet people and
not causal. The research snapshot ends July 2026. County networks are county totals, not
shelves; a county with one reporting site still shows that site's monthly totals.

Maps draw on Esri basemap tiles (Dark/Light Gray Canvas, Streets, Imagery) from
`server.arcgisonline.com`, allowed in the CSP `img-src`. CARTO's free tiles now return an
"API key required" image, so they are not used. Esri's terms expect an ArcGIS account for
production use: before a public or long-lived deployment, add an ArcGIS Location Platform key
or switch the tile URLs in `src/components/map/LeafletMap.tsx`. Without tiles (offline), maps still
draw their county and tract colors on a plain background.

## Presenting on an iPad

Open `/present`. Tap **Script** for the timed script, expanded explanation, transition,
build cues and qualifications. Tap **Q&A** for the expected questions with complete answers
and source references. Both are persistent touch buttons with 44 px minimum height.
Use **Previous**, **Next build / Next slide**, or the slide picker to navigate, including
appendices. **Close** returns to the full slide. N and Q remain optional keyboard shortcuts.
Notes are visible on the same screen, including when mirrored; this is not a separate
private presenter display. Expanded explanations are rehearsal/follow-up material, not
additional timed speech. The current deck has 12 core slides and four appendices; the
attached D-067 rehearsal PDFs describe an older 13-slide arrangement.
