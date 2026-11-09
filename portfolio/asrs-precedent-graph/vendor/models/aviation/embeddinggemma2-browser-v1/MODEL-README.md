# Aviation EmbeddingGemma 2 text encoder

Base model: Google DeepMind [EmbeddingGemma 2](https://huggingface.co/google/embeddinggemma-2),
revision `f9972ac22e696a105c482202646979e33e4b5a1e`, Apache 2.0.
The licence is included in `LICENSE`.

The CIS 634 aviation retrieval project adapted the text encoder on 16,070 incident-safe
query–summary pairs for three epochs. Selected checkpoint: `checkpoint-1506` (epoch 3).
See [the training configuration](https://github.com/Jacob19999/cis634/blob/main/configs/embeddinggemma2_browser.yaml)
and [workflow](https://github.com/Jacob19999/cis634/blob/main/agents/browser-encoder.md).

This export uses 256-dimensional normalised embeddings, a 256-token limit, block-16 int4
MatMul weights, row-int8 vocabulary tables and float32 activation tensors. Vision/audio
towers are omitted. `export.json` records the selected checkpoint, conversion checks and
all graph/weight/tokeniser hashes. It describes the offline export; browser release checks
are recorded separately in the page README.

Quantised query MRR@10 is 0.5182 on 1,000 development queries, compared with 0.3123 for
frozen MiniLM. These are automatically screened development pairs, not independent human
relevance judgements. Search similarity does not establish incident identity or causation.
