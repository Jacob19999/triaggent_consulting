const test = require('node:test');
const assert = require('node:assert/strict');
const {norms, rank, validateManifest} = require('../semantic-core.js');

test('rejects mixed checkpoints, wrong prefixes and stale catalogue order', () => {
  const sha = 'a'.repeat(64);
  const manifest = {version:2, dtype:'int8', dimensions:256, reports:2,
    ids_sha256:'ids', max_length:256, model_dtype:'q4', output:'sentence_embedding',
    query_prefix:'task: search result | query: ', model:'aviation/embeddinggemma2-browser-v1',
    revision:sha, model_export_sha256:sha};
  const assets = {transformers:'4.3.2', model:manifest.model, revision:sha, model_export_sha256:sha};
  validateManifest(manifest, assets, 2, 'ids');
  assert.throws(() => validateManifest(manifest, assets, 2, 'different-order'));
  assert.throws(() => validateManifest({...manifest, dimensions:384}, assets, 2, 'ids'));
  assert.throws(() => validateManifest({...manifest, query_prefix:''}, assets, 2, 'ids'));
  assert.throws(() => validateManifest(manifest, {...assets, revision:'b'.repeat(64)}, 2, 'ids'));
  assert.throws(() => validateManifest(manifest, {...assets, model_export_sha256:'b'.repeat(64)}, 2, 'ids'));
});

test('ranks by normalised cosine, not vector magnitude or lexical overlap', () => {
  const vectors = new Int8Array([127, 0, 3, 4, 0, 127, -127, 0]);
  const lengths = norms(vectors, 2);
  assert.deepEqual(rank(vectors, lengths, [1, 1]).map(r => r[0]), [1, 0, 2, 3]);
  assert.ok(Math.abs(rank(vectors, lengths, [1, 1])[0][1] - 7 / Math.sqrt(50)) < 1e-6);
});

test('ranks inside the allowed cohort before limiting, including sparse and empty cohorts', () => {
  const vectors = new Int8Array([127, 0, 3, 4, 0, 127, -127, 0]);
  const lengths = norms(vectors, 2);
  assert.deepEqual(rank(vectors, lengths, [1, 1], [2, 3], 1).map(r => r[0]), [2]);
  assert.deepEqual(rank(vectors, lengths, [1, 1], []), []);
  assert.deepEqual(rank(vectors, lengths, [0, 0]), []);
  assert.throws(() => rank(vectors, lengths, [NaN, 1]));
  assert.throws(() => norms(new Int8Array(2), 2));
});

const vm = require('node:vm');
const fs = require('node:fs');
test('client discards stale requests and resolves cancellation without reopening the palette', async () => {
  const messages = [];
  let worker;
  class Worker {
    constructor() { worker = this; }
    postMessage(message) { messages.push(message); }
    terminate() {}
  }
  const context = vm.createContext({Worker, URL, document:{baseURI:'https://example.com/explorer/'}});
  vm.runInContext(fs.readFileSync(require.resolve('../semantic-search.js'), 'utf8'), context);
  const client = new context.SemanticSearch(['ASRS:1']);
  const first = client.search('hydraulic failure', null);
  const firstId = messages.at(-1).id;
  const second = client.search('fuel starvation', [1]);
  const secondId = messages.at(-1).id;
  assert.equal(await first, null);
  worker.onmessage({data:{type:'results', id:firstId, results:[[0, 1]]}});
  worker.onmessage({data:{type:'results', id:secondId, results:[[1, .8]]}});
  assert.deepEqual(await second, [[1, .8]]);
  const third = client.search('uncontrolled descent', null);
  client.cancel();
  assert.equal(await third, null);
});
