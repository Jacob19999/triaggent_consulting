# ASRS narrative graph (all 47,723 reports)

A knowledge graph extracted by a local LLM from every NASA ASRS report in the Apache-2.0
[`elihoole/asrs-aviation-reports`](https://huggingface.co/datasets/elihoole/asrs-aviation-reports)
dataset (47,723 reports after cleaning). It was produced by the CIS 634
[`asrsbench`](https://github.com/Jacob19999/cis634) project and is not yet wired into the
[ASRS Precedent Graph](../portfolio/asrs-precedent-graph/) page.

| File | Contents |
| --- | --- |
| `qwen3-8b_v1.jsonl.gz` | One JSON line per report (9.4 MB gzipped, 55 MB raw) |
| `llm_graph.py` | The extraction script (`scripts/llm_graph.py` in cis634, commit `e31bd7e`) |

## How it was made

- Model: Qwen3-8B (Q4_K_M) served by Ollama 0.40.14 on an RTX 5070, temperature 0, thinking
  off, output constrained to a JSON schema. Prompt version `v1`.
- Input: the report narrative only, cut at 1,500 words (262 reports, 0.5%, were cut). The
  analyst synopsis and coded fields are never shown to the model, because cis634 uses them as
  retrieval queries and relevance labels.
- 47,723 of 47,723 reports extracted with no failures; 33.3M prompt tokens and 15.4M output
  tokens, at about 0.76 reports/s with 8 parallel requests.

## Record format

```json
{"acn": "1000003", "model": "qwen3:8b", "prompt_version": "v1",
 "graph": {"aircraft": ["c172"], "flight_phases": ["Takeoff"],
           "events": ["nose gear retracted", "propeller struck runway"],
           "causes": ["not following checklist"], "actors": ["Pilot (single)"],
           "equipment": ["nose gear", "gear handle"], "locations": ["runway"],
           "outcomes": ["tower notified"],
           "triples": [{"s": "nose gear retracted", "r": "led_to", "o": "propeller struck runway"}]},
 "truncated": false, "prompt_tokens": 537, "output_tokens": 307}
```

- `flight_phases` and `actors` come from fixed lists (12 phases, 11 actor types).
- The other lists are free-text phrases, at most 6 per field and 60 characters each.
- `triples` link those phrases with one of `caused`, `contributed_to`, `led_to`, `detected`,
  `responded_with`, `involved` (up to 6 per report).

| Field | Mean per report | Empty | Distinct values |
| --- | ---: | ---: | ---: |
| aircraft | 1.02 | 16.7% | 4,268 |
| flight_phases | 2.00 | 3.5% | 12 |
| events | 4.35 | 0.0% | 85,223 |
| causes | 3.63 | 0.8% | 80,329 |
| actors | 3.73 | 1.5% | 11 |
| equipment | 4.01 | 1.8% | 32,204 |
| locations | 3.17 | 5.0% | 31,257 |
| outcomes | 3.12 | 0.9% | 58,431 |
| triples | 5.97 | 0.1% | 261,303 |

The most common events are altitude deviation (6,592 reports), runway incursion (3,761) and
traffic conflict (1,829). The most common causes are frequency congestion (1,902), fatigue
(1,676) and miscommunication (1,467).

## Caveats

- Free-text phrases are not normalised: "communication failure", "poor communication" and
  "miscommunication" are separate values. Cluster or map them before using them as graph nodes.
- Labels are not backed by quotes, unlike the Precedent Graph's 3,000-report coding, and have
  not been checked by hand.
- The schema differs from the Precedent Graph's factor layers, so this file cannot replace its
  `data/graph.json` directly.

## Rerunning

From a cis634 checkout with `asrsbench prepare` done and Ollama serving `qwen3:8b`
(`OLLAMA_NUM_PARALLEL=8` for this throughput):

```bash
.venv/Scripts/python.exe scripts/llm_graph.py --workers 8
```

It appends to `data/graph/qwen3-8b_v1.jsonl` and resumes an interrupted run.
