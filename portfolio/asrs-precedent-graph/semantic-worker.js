/* Encode queries and rank static int8 summary vectors away from the map's UI thread. */
importScripts('semantic-core.js');
let loading, extractor, vectors, lengths, manifest;
let latest = 0;
const queries = new Map();
const status = message => postMessage({type: 'status', message});
async function sha256(bytes) {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
}
async function loadRuntime(assets) {
  const url = `https://cdn.jsdelivr.net/npm/@huggingface/transformers@${assets.transformers}/dist/transformers.min.js`;
  const response = await fetch(url, {integrity: assets.transformers_integrity});
  if (!response.ok) throw new Error('Could not download Transformers.js');
  const moduleUrl = URL.createObjectURL(new Blob([await response.arrayBuffer()], {type: 'text/javascript'}));
  try {
    return await import(moduleUrl);
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }
}
async function load(ids) {
  status('Downloading meaning search · first use may take a moment…');
  const response = await fetch('data/semantic/manifest.json', {cache: 'no-cache'});
  if (!response.ok) throw new Error('Semantic index is missing');
  manifest = await response.json();
  const assetsResponse = await fetch('vendor/semantic-assets.json', {cache: 'no-cache'});
  if (!assetsResponse.ok) throw new Error('Semantic model assets are missing');
  const assets = await assetsResponse.json();
  SemanticCore.validateManifest(manifest, assets, ids.length,
    await sha256(new TextEncoder().encode(ids.join('\n'))));
  const modelPromise = (async () => {
    const modelRoot = new URL(`vendor/models/${manifest.model}/`, self.location.href);
    const response = await fetch(new URL('export.json', modelRoot));
    if (!response.ok || await sha256(await response.arrayBuffer()) !== manifest.model_export_sha256) {
      throw new Error('Semantic model provenance does not match this index');
    }
    const [runtime, {loadAviationEncoder}] = await Promise.all([
      loadRuntime(assets),
      import(new URL('semantic-encoder.mjs', self.location.href).href),
    ]);
    runtime.env.backends.onnx.wasm.wasmPaths = new URL('vendor/transformers/', self.location.href).href;
    // A single WASM thread also works on static hosts without cross-origin isolation headers.
    runtime.env.backends.onnx.wasm.numThreads = 1;
    return loadAviationEncoder(runtime, modelRoot.href, 'wasm');
  })().catch(error => {throw new Error(`Model load: ${error.message}`);});
  const indexPromise = (async () => {
    vectors = new Int8Array(manifest.reports * manifest.dimensions);
    let next = 0;
    // Bound concurrent memory/download pressure on phones and reject gaps or overlaps.
    for (const shard of manifest.shards) {
      if (shard.start !== next || !Number.isInteger(shard.rows) || shard.rows < 1 ||
          !/^vectors-\d+-[a-f0-9]+\.bin$/.test(shard.file)) throw new Error('Invalid semantic shard');
      const res = await fetch(`data/semantic/${shard.file}`);
      if (!res.ok) throw new Error('Could not download semantic vectors');
      const bytes = await res.arrayBuffer();
      if (bytes.byteLength !== shard.rows * manifest.dimensions ||
          await sha256(bytes) !== shard.sha256) throw new Error('Damaged semantic shard');
      vectors.set(new Int8Array(bytes), shard.start * manifest.dimensions);
      next += shard.rows;
    }
    if (next !== manifest.reports) throw new Error('Incomplete semantic index');
    lengths = SemanticCore.norms(vectors, manifest.dimensions);
  })().catch(error => {throw new Error(`Index load: ${error.message}`);});
  [extractor] = await Promise.all([modelPromise, indexPromise]);
  status('Meaning search ready · runs on your device');
}
onmessage = async ({data}) => {
  if (data.type === 'cancel') { latest = data.id; return; }
  if (data.type !== 'search') return;
  latest = data.id;
  try {
    loading ||= load(data.ids).catch(error => {loading = null; throw error;});
    await loading;
    if (data.id !== latest) return;
    let query = queries.get(data.query);
    if (!query) {
      status('Finding the closest meanings…');
      query = await extractor(data.query);
      if (queries.size > 50) queries.clear();
      queries.set(data.query, query);
    }
    if (data.id !== latest) return;
    const results = SemanticCore.rank(vectors, lengths, query, data.allowed, 100);
    postMessage({type: 'results', id: data.id, results});
  } catch (error) {
    if (data.id === latest) postMessage({type: 'error', id: data.id, message: error.message});
  }
};
