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

Open `http://127.0.0.1:8765`. No JavaScript build or backend is required. D3 is vendored.
Reports load from `data/graph.json` (v1) or `data/reports/<k>.json` (v2). Narratives load on
request from `data/narratives/<k>.json`; do not preload the narrative corpus into the browser.

## Search and linking

- Keyword search covers the common AI summary, original synopsis/probable cause, identifiers,
  aircraft, airport, coded factors and extracted event text. All query words must match.
  Source, date, place and active factor filters apply to search suggestions. Summary matches
  rank above matches in source abstracts; the number of coded factors is not a ranking boost.
- Source scope offers all reports, ASRS (both analyst-coded and narrative-only), or NTSB.
  Estimated ASRS dates carry `≈`.
- The map and narrative links use precomputed embeddings. The search box does **not** call a
  live embedding model. A future semantic query service can use the BM25 + Qwen hybrid in
  `cis634/configs/corpus_v2.yaml`; keep that distinction explicit in the interface.
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
source, year, keyword and coded-factor filters, independent of the graph filters. It includes:

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

Run both UI logic suites with `node --test tests/*.cjs` (nine tests). Browser checks covered
source/year filters, empty cohorts, matrix drill-down, report navigation and mobile layout.
