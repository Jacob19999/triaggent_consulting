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
- **Meaning** mode runs a small MiniLM model in the browser and ranks summary embeddings.
  The map and narrative links use separate, precomputed Qwen embeddings. See the browser
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
ranks all report summaries by cosine similarity using MiniLM-L6-v2. Select **Keywords** for
the original all-words matching. Case numbers, numeric aircraft types and uppercase airport
codes use direct keyword lookup in either mode. Source, year, place, fatality, factor and
region filters restrict the candidate set **before** ranking. The top eight results display
cosines, with an action to show the closest 100 on the map. These are a shortlist, not an
exhaustive relevance set; cosine is not a probability or an assessment of safety severity.

This works as static files on Vercel Hobby: there is no API key, inference Function, database
or paid search service. Static delivery still counts towards the hosting plan's transfer
allowance. The 33.6 MiB int8 index downloads on first meaning search; Transformers.js 3.8.1,
its WASM runtime and the small quantised ONNX model are vendored and served by the same
site. Total additional uncompressed assets are about 78 MiB (including the index). Model
assets use browser caching. Queries are processed locally and are not
sent to an inference provider. A worker keeps encoding and ranking off the map's UI thread.
First-use loading may take time on slow connections or phones. Loading failures are labelled
and leave keyword search available. Pending results are discarded when queries, modes or
filters change or the palette closes.

This summary search is a separate model and index from the Qwen3-Embedding-8B **narrative**
links already on the map. It searches AI summaries (synopsis fallback), not full narratives.
Document vectors use the original MiniLM checkpoint; browser queries use its q8 ONNX
conversion. Both use mean pooling, unit normalisation and a 256-token limit. Document vectors
are quantised symmetrically per report; scoring divides by the stored int8 vector's norm.
Minor numerical differences from float32 inference are expected.

After replacing the report export, regenerate this index from the `cis634` checkout:

```sh
.venv/bin/python scripts/export_semantic_search.py /path/to/page \
  --browser-revision 751bff37182d3f1213fa05d7196b954e230abad9
```

Commit and deploy `data/semantic/manifest.json` with **all** the binary shards it names,
`semantic-core.js`, `semantic-worker.js`, `semantic-search.js`, `vendor/transformers/`,
`vendor/models/`, `vendor/semantic-assets.json` and `index.html`. No Vercel
build command or server configuration is required. Shards are below 8 MB and named by their
content hash. Report identity/order and every downloaded shard are SHA-256 checked; a stale
catalogue/index pairing fails visibly instead of returning the wrong report. This is an
independent UI export and does not alter benchmark caches or reported results.
