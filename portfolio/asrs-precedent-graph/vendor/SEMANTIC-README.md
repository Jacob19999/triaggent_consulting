# Browser search assets

Pinned distribution files for browser-only semantic search. No package installation
or build step is needed at deployment time. `semantic-assets.json` records each file's SHA-256.
The worker checks that the model/index versions agree before loading report vectors.

- Transformers.js **4.3.2** is fetched from jsDelivr on first use. The worker checks the
  bundle against the official npm file's SHA-256 via Fetch subresource integrity.
  ONNX Runtime Web **1.31.0-dev.20260914-8d85527a0** supplies the matching
  `ort-wasm-simd-threaded.*` JS/WASM files. The plain, `jsep`, `jspi` and `asyncify`
  variants support different browsers; only the selected variant is downloaded.
  Transformers.js Apache 2.0 licence: `transformers/LICENSE`.
  ONNX Runtime MIT licence: `transformers/ONNX-LICENSE`.
- Model: `aviation/embeddinggemma2-browser-v1`, the project's epoch-3 aviation adaptation
  of Google's Apache-2.0 `google/embeddinggemma-2`, base revision
  `f9972ac22e696a105c482202646979e33e4b5a1e`. The model is text-only. Its `export.json`
  pins all eight graph, weights and tokeniser files. The manifest revision is the SHA-256
  of that export record, not a Hugging Face branch name. The checkpoint and export method
  are recorded beside the model; model files are installed from the completed research run.

Query encoding runs on-device with single-threaded WASM. The CDN serves only the
Transformers.js bundle. The worker disables remote model loading and uses the site's model,
WASM and index files without special response headers.
