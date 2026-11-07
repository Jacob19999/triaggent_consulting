/* Pure cosine ranking for the browser's independent MiniLM summary index. */
(function (root) {
  'use strict';
  function norms(vectors, dimensions) {
    if (!Number.isInteger(dimensions) || dimensions < 1 || vectors.length % dimensions) {
      throw new Error('Invalid semantic index dimensions');
    }
    const result = new Float32Array(vectors.length / dimensions);
    for (let i = 0; i < result.length; i++) {
      let sum = 0;
      for (let d = 0; d < dimensions; d++) sum += vectors[i * dimensions + d] ** 2;
      result[i] = Math.sqrt(sum);
      if (!result[i]) throw new Error('Empty semantic vector');
    }
    return result;
  }
  function rank(vectors, lengths, query, allowed = null, limit = 100) {
    const dimensions = query.length, candidates = allowed === null ? lengths.keys() : allowed;
    if (!dimensions || vectors.length !== lengths.length * dimensions ||
        !Number.isInteger(limit) || limit < 1 || !Array.from(query).every(Number.isFinite)) {
      throw new Error('Invalid semantic query');
    }
    const qnorm = Math.hypot(...query);
    if (!qnorm) return [];
    const best = [];
    // Keep only the top k; do not sort or transfer all 91k report scores on every keystroke.
    for (const i of candidates) {
      if (!Number.isInteger(i) || i < 0 || i >= lengths.length) continue;
      let dot = 0;
      const offset = i * dimensions;
      for (let d = 0; d < dimensions; d++) dot += vectors[offset + d] * query[d];
      const score = Math.max(-1, Math.min(1, dot / (lengths[i] * qnorm)));
      if (best.length === limit && score <= best[best.length - 1][1]) continue;
      let at = best.length;
      while (at > 0 && score > best[at - 1][1]) at--;
      best.splice(at, 0, [i, score]);
      if (best.length > limit) best.pop();
    }
    return best;
  }
  const api = {norms, rank};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SemanticCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
