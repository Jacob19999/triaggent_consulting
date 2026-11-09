# Aviation Precedent Explorer

A static explorer of NASA ASRS reports and NTSB investigations. The source of truth for
corpus preparation and export is `Jacob19999/cis634`; this folder serves the generated data.
The existing `/portfolio/asrs-precedent-graph/` URL remains valid.

## Preview and checks

From this folder:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
node --test tests/unified.test.cjs
```

Open `http://127.0.0.1:8765`. No JavaScript build or backend is required. D3 is vendored; meaning search downloads its model on demand.
Reports load from `data/graph.json` (v1) or `data/reports/<k>.json` (v2). Narratives load on
request from `data/narratives/<k>.json`; do not preload the narrative corpus into the browser.

## Mobile workspace

On phones, the default workspace keeps the map visible. The welcome content is behind the
**Getting started** bar; selecting a report opens a smaller reading panel. **Show map**
collapses that panel, **Full screen** expands it and **Split view** returns to the smaller
panel. Opening **Focus** collapses the reading panel so the graph remains visible.

**Map options** opens the colour key, source-intersection controls and severity overlay.
Those controls start collapsed and include **Done · show map**. The **Filters** button
(**Explore** on desktop) opens source/date/place filters and link settings with a sticky
**Done** button. Opening either settings panel dismisses the other. Tapping the map outside
Map options or pressing Escape dismisses the options. View buttons return to the graph
without leaving the settings over it. Search sits above the view tabs and uses a shorter
phone placeholder.

The map refits on width changes such as rotation; a height change from the software keyboard
keeps the camera. Desktop keeps its visible legend and side-by-side panels. Checks covered
412 × 780 (an S22-sized browser area), 360 × 640, 320 × 640, landscape, desktop, search,
report reading, Focus, settings and the tutorial.

## First-visit mobile tutorial

After the report collection loads, a first-time phone visitor can choose **Start tutorial**
or **Skip to website**. The eight-step guide follows a safety investigator’s workflow on
the live interface: choose Meaning or Keywords, describe an incident, select a real search
result, read its summary, check the original text, read the t-SNE map, open Focus and
interpret its connections. The optional “windshear” example uses Keywords and does not
require a meaning-search model download.

The map explanation covers report dots, approximate narrative similarity, colours, repeated
region names, panning/zooming and selecting a report. It distinguishes the two-dimensional
map from geography, time, severity and calibrated similarity scores. The Focus explanation
covers report circles, shared-factor squares, solid factor links, dashed text links and
following neighbours or adjusting link weights in Filters (Explore on desktop). Both views support investigation;
their relationships do not establish incident identity or causality.

The guide uses a spotlight and arrow around the actual control, supports Back, Exit and
Escape, and keeps keyboard focus in the highlighted control and guide. Its card follows the
visual viewport when the software keyboard opens. A pending or empty search provides a way
back to edit the query. Original narratives still load only when their heading is opened.

Skip, Exit and completion are remembered per browser/origin in local storage under
`aviation-search-tutorial-v1`. If storage is unavailable, the guide still works, but a later
visit may show the offer again. Desktop visits do not automatically show the offer.
Visitors on any device can replay it from **ⓘ → Start guided search tutorial**.
`onboarding.js` owns the guide; the small adapter in `index.html` uses the existing search,
report and view actions. `onboarding.css` styles the overlay without changing the report data.

For browser verification, use a fresh origin or clear this site's tutorial storage entry:

1. At a phone viewport, check the first-visit Start/Skip choice; skip and reload to verify it
   is remembered. A fresh desktop visit should open directly into the explorer.
2. Replay from ⓘ, choose the Keywords example and select the highlighted report. Check its
   summary and open the original text; the narrative should remain readable and scrollable.
3. Continue through the map and Focus explanations. Check the selected report's Focus graph,
   then finish and reload; the first-visit offer should remain dismissed.
4. Check Back, Exit, Escape, a blank query, a query with no matches, keyboard navigation,
   a 320px-wide phone and a reduced-height viewport representing the software keyboard.

## Search and linking

- The circled info button beside the view controls opens a keyboard-accessible map guide.
  It explains report dots, t-SNE positions, repeated automatic region names, source links
  and the separate Focus layout. Escape or Close dismisses it and returns focus to the button.
- In **Keywords** mode, search covers the common AI summary, original synopsis/probable cause, identifiers,
  aircraft, airport, coded factors and extracted event text. All query words must match.
  Source, date, place and active factor filters apply to search suggestions. Summary matches
  rank above matches in source abstracts; the number of coded factors is not a ranking boost.
- Source scope offers all reports, ASRS (both analyst-coded and narrative-only), or NTSB.
  Estimated ASRS dates carry `≈`.
- **Meaning** mode runs an aviation-tuned EmbeddingGemma 2 text encoder in the browser
  and ranks summary embeddings.
  The map and narrative links use separate, precomputed aviation-tuned Qwen3 embeddings
  from epoch 3 (`checkpoint-3123`). See the browser
  semantic search section below for downloads, regeneration and deployment.
- Each report's `cross` shortlist contains up to six neighbours from the other reporting
  system, using cosine similarity of mean Qwen3-Embedding-8B narrative chunk vectors. The UI
  displays up to four and supports comparison. Date/time/place filters narrow this shortlist;
  the current source scope is intentionally bypassed to reach the other system. This is a
  shortlist, not an exhaustive search within a filtered subset.
- Identical coded factor labels within the same category are aligned across ASRS and NTSB.
  Each report retains its original coding provenance in `evidence`. LLM-inferred factors stay
  separate. No synonym or causal equivalence is inferred from different official codes.
- Similarity is not incident identity, causality or a probability. Confirmed sibling reports
  still come exclusively from the corpus's `group_id` grouping.
- AI summaries are distinct from ASRS analyst synopses and NTSB probable causes. A generated
  fallback is never labelled as an official probable cause.

## Regenerate data

In the `cis634` checkout on the machine holding corpus v2, all summaries and cached embeddings:

```sh
.venv/bin/python scripts/export_precedent_graph_v2.py /path/to/staging-page --without-graph
```

For the aviation-tuned epoch-3 map and report links, use the completed evaluation caches:

```sh
.venv/bin/python scripts/export_precedent_graph_v2.py /path/to/staging-page \
  --without-graph --finetune-condition results/finetune_8b_v1/epoch3
```

This verifies the sealed corpus hash, checkpoint weights, evaluation fingerprint, chunk
coverage and report order before pooling the cached chunk vectors. It rebuilds narrative
and cross-source links, t-SNE positions and region labels. The map cache includes the vector
content hash so a frozen layout cannot be reused for an adapted checkpoint. The export's
`meta.narrative_encoder` records the exact checkpoint and fingerprint. Copy only `graph.json`,
`reports/` and `narratives/` from this export; preserve `data/semantic/` and `vendor/`, which
belong to the independent Gemma browser search. Report IDs and order must match its manifest.

Epoch 3 was selected on held-out ASRS synopsis MRR@10 (0.3930 → 0.5202). Topical dev silver
nDCG@10 fell from 0.8413 to 0.7976; independent relevance judging is unfinished. These results
do not validate cross-source analogues or make the cosine cutoff a relevance threshold.
The Source overview defaults to cosine 0.55 for epoch 3 (7,597 reports / 13,582 pairs
in the full catalogue); the slider spans 0–1. The frozen model's former 0.85 default
would show no epoch-3 pairs, whose maximum exported cross-source cosine is 0.7989.
This is a display default chosen from the score distribution, not a relevance calibration.

Use `--without-graph` until the separate Qwen3-8B graph extraction is available. It preserves
coded factors, summaries and narrative similarities without inventing graph-derived evidence.
Omit it and supply `--graph` when extraction is complete. The exporter fails before encoding
if any narrative embedding cache is missing. It still computes the map and nearest neighbours.

Copy the staging `data/` into this folder after validating counts, shard sizes and links.
Keep all report and narrative shards from the same export: neighbour indices and shard offsets
refer to the report ordering. Deep links now use source-qualified document IDs; legacy `#acn`
and `#focus` links remain supported. Do not merge or publish to production as part of a preview.

## Safety analytics (third view)

Open `#analytics` or use the Analytics button beside Map and Focus. This view has its own
source, year, fatality bucket, keyword and coded-factor filters, independent of the graph filters. It includes:

- Report counts by year, with separate ASRS coded, ASRS narrative-only and NTSB series.
- Frequent source-coded factors, with counts and percentages within each source's cohort.
- A phase/event matrix: select a cell to require both coded factors.
- Coding coverage by source and category, including uncoded reports in the denominator.
- A sortable reading queue, source-report navigation, map drill-down and cohort CSV export.

A report is counted once per factor and matrix cell. A report may contribute to several
categories; category totals are not additive. LLM-inferred factors are excluded. The report
catalogue does not include exposure denominators or validated cross-source incident identities,
so these are descriptive collection statistics, not accident rates or unique incident counts.
Estimated ASRS dates and the incomplete latest year remain visible.

CSV includes the full current cohort, not just the first 30 reading-queue entries. Text fields
are quoted and formula-like prefixes are neutralised for spreadsheet readers. The export
button also leaves a persistent Save CSV link, which remains valid until the next export.
Download handling depends on the browser; the in-app browser's download event could not be
captured during automated testing, while CSV preparation and the generated save link were checked.

Run all UI logic suites with `node --test tests/*.cjs` (17 tests). Browser checks covered
source/year filters, empty cohorts, matrix drill-down, report navigation and mobile layout.

## Source-map intersections and severity

Only the **Source** colour mode exposes the intersection controls and injury overlay. Cyan
halos mark reports with at least one exported ASRS ↔ NTSB narrative neighbour meeting the
overview cosine cutoff (default 0.85, adjustable 0.70–0.90). Pair counts deduplicate reverse
links and require both endpoints in the current filtered cohort. These are semantic analogues,
not confirmed same-incident links or an assertion of causal equivalence. The cutoff is a
visual exploration control, not a calibrated relevance threshold or probability.

Selecting a report in Source mode draws its six closest exported other-source neighbours
within the current cohort, regardless of the overview cutoff. Line width and numeric labels
encode narrative cosine. The inspector exposes shared coded factor names and opens the
existing comparison view. t-SNE screen distance remains an approximate layout; it is not the
similarity score. A source-only filter can remove all cross-source pairs from the cohort.

Optional rings encode the highest recorded NTSB injury category: minor, serious or fatal.
Damage is shown separately in the inspector. No ring means no injury code in this export;
it does not imply no injuries. ASRS severity is unencoded. To keep an overview readable, the
renderer retains the highest severity ring in each 10 px screen cell, while preserving the
selected report and its neighbours. These marks are not an exhaustive count at overview scale.
Switching colour modes removes the source overlay, controls and source-specific inspector.


## Fatality buckets

Search scope and Analytics both offer 0, 1, 2–5, 6–10, 11+ and Unknown / not recorded.
`fatalities` is the NTSB event total (`events.inj_tot_f`), joined using the source event ID,
not a count inferred from narratives or the highest-injury code. ASRS has no comparable
count and stays unknown. Missing or invalid counts also remain unknown, never zero.
Fatality scope narrows related-report and cross-source shortlists like date/time/place.
Analytics applies it to every chart, the reading queue, map drill-down and CSV; Reset clears it.
The CSV includes `fatalities` (blank when unknown) and `fatality_bucket`.

Full v2 exports include counts. To refresh just this metadata in an existing export without
re-encoding, recomputing the map or changing report order, run from the cis634 checkout:

```sh
.venv/bin/python scripts/export_precedent_graph_v2.py /path/to/page --fatalities-only
```

This uses `data/external/ntsb/events.parquet` (or `--ntsb /path/to/ntsb`). All 24,557 NTSB
reports in the current export have counts: 19,784 zero; 2,579 one; 2,037 two to five;
113 six to ten; 44 eleven or more. The 67,270 ASRS reports remain unknown.

## Browser semantic search (Vercel Hobby)

The search palette defaults to **Meaning**. It embeds the query on the visitor's device and
ranks all report summaries by cosine similarity using aviation-tuned EmbeddingGemma 2. Select **Keywords** for
the original all-words matching. Case numbers, numeric aircraft types and uppercase airport
codes use direct keyword lookup in either mode. Source, year, place, fatality, factor and
region filters restrict the candidate set **before** ranking. The top eight results display
cosines, with an action to show the closest 100 on the map. These are a shortlist, not an
exhaustive relevance set; cosine is not a probability or an assessment of safety severity.

This works as static files on Vercel Hobby: there is no API key, inference Function, database
or paid search service. Static delivery still counts towards the hosting plan's transfer
allowance. The 22.4 MiB int8 index downloads on first meaning search. The worker fetches
Transformers.js 4.3.2 from jsDelivr with a pinned integrity hash. The site serves the
matching WASM variants, tokeniser and q4 ONNX model. Model/tokeniser files total 259 MiB,
before the index and selected WASM runtime.
The runtime loads only the variant supported by the browser. Model assets use browser
caching. Queries are processed locally and are not
sent to an inference provider. A worker keeps encoding and ranking off the map's UI thread.
First-use loading may take time on slow connections or phones. Loading failures are labelled
and leave keyword search available. Pending results are discarded when queries, modes or
filters change or the palette closes.

This summary search is a separate model and index from the Qwen3-Embedding-8B **narrative**
links already on the map. It searches AI summaries (synopsis fallback), not full narratives.
Document vectors use aviation checkpoint `checkpoint-1506` (epoch 3); browser queries use
its block-16 q4 ONNX conversion with row-int8 vocabulary lookup and float32 activation
tensors. Both use the published query/document prefixes, mean pooling and projection,
256-dimensional Matryoshka output, unit normalisation and a 256-token limit. Document vectors
are quantised symmetrically per report; scoring divides by the stored int8 vector's norm.
Minor numerical differences from float32 inference are expected.

The checkpoint was selected on 1,000 held-out incident queries searching 91,827 summaries.
Quantised-query development MRR@10 is 0.5182, versus 0.3123 for the previous frozen MiniLM.
These are development results from automatically screened query–summary pairs, not human
relevance judgements or a measure of operational safety. Topical development labels are silver.

Release checks verified every model and vector hash and matched all 91,827 summaries to
the encoded catalogue. The trained package returned the expected top report for both
conversion probes in the browser. A 412 × 780 viewport showed the Meaning results and
opened the closest 100 on the map without horizontal overflow.

Install the sealed package from the `cis634` checkout, preserving exact summary text:

```sh
.venv/bin/python scripts/install_browser_encoder.py \
  models/finetuning/embeddinggemma2-browser-v1/browser /path/to/page \
  --catalogue cache/browser-release-catalogue.jsonl
```

Commit and deploy `data/semantic/manifest.json` with **all** the binary shards it names,
`semantic-core.js`, `semantic-worker.js`, `semantic-encoder.mjs`, `semantic-search.js`, `vendor/transformers/`,
`vendor/models/`, `vendor/semantic-assets.json` and `index.html`. No Vercel
build command or server configuration is required. Deploy through the Git integration;
the complete source exceeds the Hobby CLI source-upload limit. Vector shards are below
6 MB and named by their content hash; weight shards are at most 64 MiB. Report identity/order,
model provenance and every downloaded index shard are SHA-256 checked; a stale
catalogue/index pairing fails visibly instead of returning the wrong report. This is an
independent UI export and does not alter benchmark caches or reported results.
