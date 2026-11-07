# Browser search assets

Pinned, unmodified distribution files for browser-only semantic search. No package installation
or build step is needed at deployment time. `semantic-assets.json` records each file's SHA-256.
The worker checks that the model/index versions agree before loading report vectors.

- Transformers.js **3.8.1**: `dist/transformers.min.js` and the two
  `dist/ort-wasm-simd-threaded.jsep.*` files from the official npm package via
  `https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/`.
  Transformers.js Apache 2.0 licence: `transformers/LICENSE`.
  ONNX Runtime MIT licence: `transformers/ONNX-LICENSE`.
- Model: `Xenova/all-MiniLM-L6-v2`, commit
  `751bff37182d3f1213fa05d7196b954e230abad9`, from
  `https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/751bff37182d3f1213fa05d7196b954e230abad9/`.
  Files: `config.json`, `tokenizer.json`, `tokenizer_config.json`,
  `special_tokens_map.json` and `onnx/model_quantized.onnx`. This is the ONNX conversion
  of `sentence-transformers/all-MiniLM-L6-v2` (Apache 2.0). Its licence is included in
  `models/Xenova/all-MiniLM-L6-v2/LICENSE`.

Queries are never sent to these upstream hosts at runtime: the worker disables remote model
loading, uses local vendored files and runs single-threaded WASM without special response
headers. Keep these files with the page when copying or deploying it.
