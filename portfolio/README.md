# Portfolio projects

`gradient-descent/` is the production build of the interactive course at
[Jacob19999/gradient-descent](https://github.com/Jacob19999/gradient-descent),
currently built from commit `dd2dd02`. It is served at
`/portfolio/gradient-descent/` and linked from the homepage portfolio section.

To refresh it, build the course with `npm run build`, then replace the contents
of `portfolio/gradient-descent/` with the contents of the course's `dist/`
directory. Preserve the directory structure: its JavaScript, styles, fonts,
and model weights load from `assets/` relative to `index.html`.

`mission-control/` is a read-only replay of the EDF mission-control console from
[Jacob19999/tvc-retro-propulsion](https://github.com/Jacob19999/tvc-retro-propulsion)
(`simulation/isaac/mission_control`). It is a static page served at
`/portfolio/mission-control/`: the real UI replays 13 recorded NVIDIA Isaac Sim
flights (convex SOCP powered-descent guidance on an electric ducted-fan
vehicle, including two failures) from gzipped JSON in `api/`. Nothing runs
server-side; launching new missions is disabled by `demo-shim.js`. To refresh
it, run `python -m mission_control.export_static_demo <this repo>/portfolio/mission-control`
from `simulation/isaac` in the source repo, then replace this directory. It must
stay together: every URL is relative to `index.html`.

`beyond-wrvus/` is a password-protected, explorable copy of the Beyond wRVUs value platform at
`/portfolio/beyond-wrvus/`. `index.html` holds only the AES-256-GCM-encrypted page and a password
form, which decrypts it in the browser (key from PBKDF2-SHA256). Nothing runs server-side, and the
current files hold only ciphertext. Commits before the password was added still contain the
plaintext page. It runs on public data (CMS Medicare 2024, NCI
State Cancer Profiles, USDA, Census, ClinicalTrials.gov) with d3 and topojson vendored under
`vendor/`. The password-protected `sgo/` app carries the full version, including the licensed
MarketView layer; this copy omits that module and any internal paths. To refresh it, run
`python3 build_platform.py --public` and then `node encrypt_public_copy.mjs` in the BData repo's
`women opportunity/platform/` folder. The second command asks for the page password and writes the
encrypted `index.html` and `vendor/` here. Never copy the plaintext build into this directory. Keep
`index.html` and `vendor/` together.

`asrs-precedent-graph/` is the ASRS Precedent Graph at `/portfolio/asrs-precedent-graph/`, a
search-first graph explorer over 3,000 NASA ASRS approach-and-landing reports (January 2012 to
March 2022, from the Apache-2.0 `elihoole/asrs-aviation-reports` dataset). Reports link through
the ASRS analyst codes they share (components mapped to ATA chapters), through the approach type,
CRM and automation factors and event sequences that a local LLM (Qwen3-4B-Instruct, 4-bit MLX)
coded from each narrative, each label kept only if a quote from the report supports it, and
through narrative similarity (MPNet plus TF-IDF). It runs entirely in the browser:
`data/graph.json` holds the factors, neighbour lists and map coordinates, `data/narratives.json`
loads when a reader opens a narrative, and d3 is vendored under `vendor/`. To refresh it, rerun
the graph-explorer pipeline (see its README), then run
`python export_static.py <this repo>/portfolio/asrs-precedent-graph --home` from its `pipeline/`
folder, which replaces `index.html`, `data/` and `vendor/`. Keep the three together.

The hosted FoodBridge app is the Next.js project at `apps/foodbridge/` (manager workspace,
shelf portal, and findings). It ships county and tract aggregates only: no site identifiers,
census blocks, or licensed Map the Meal Gap values. Rebuild the bundle in the Maverick
Intelligence repository with `uv run python -m mi.foodbridge_bundle`, copy `data/research.json`
and `public/data/` into `apps/foodbridge/`, and redeploy that Vercel project.
`portfolio/foodbridge/` redirects to the hosted app at https://foodbridge-jet.vercel.app/.

The other portfolio cards link to separate sites:

- Optimist Club of Minnesota Valley: https://optimistmv.com/
- Toby Leonard for Mankato Mayor: https://www.mankatomayor.com/
- Jackie Henry for Minnesota Senate: https://www.henry4senate.com/
- Joel Hollerich for District 77 School Board: https://www.joelhollerich.com/
