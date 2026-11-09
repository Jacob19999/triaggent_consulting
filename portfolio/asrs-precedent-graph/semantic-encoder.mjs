/* Client for the isolated Gemma package; import the pinned, vendored Transformers.js 4.3.2. */
export async function loadAviationEncoder({AutoModel, AutoTokenizer, env}, modelRoot, device = 'wasm') {
  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  const modelUrl = new URL(modelRoot, location.href);
  if (modelUrl.origin !== location.origin || !modelUrl.pathname.endsWith('/')) {
    throw new Error('Expected a same-origin model directory ending with a slash');
  }
  // Local metadata discovery in this runtime expects a path, not an absolute HTTP URL.
  const modelPath = modelUrl.pathname;
  const config = await (await fetch(new URL('config.json', modelUrl))).json();
  if (config.vision_config !== null || config.audio_config !== null) {
    throw new Error('Expected a text-only model');
  }
  const tokenizer = await AutoTokenizer.from_pretrained(modelPath);
  const model = await AutoModel.from_pretrained(modelPath, {config, device, dtype: 'q4'});
  return async text => {
    const inputs = await tokenizer(`task: search result | query: ${text}`, {
      truncation: true, max_length: 256, padding: true,
    });
    const result = await model(inputs);
    const query = new Float32Array(result.sentence_embedding.data);
    if (query.length !== 256 || !query.every(Number.isFinite) || Math.hypot(...query) === 0) {
      throw new Error('Invalid query embedding');
    }
    return query;
  };
}
