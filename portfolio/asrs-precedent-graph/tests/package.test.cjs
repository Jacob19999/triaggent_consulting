/* Verify the deployed binary bundle and its conversion fixtures without model downloads. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {norms, rank} = require('../semantic-core.js');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name));
const json = name => JSON.parse(read(name));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

test('static model and index hashes match the exact deployed report order', () => {
  const manifest = json('data/semantic/manifest.json');
  const assets = json('vendor/semantic-assets.json');
  assert.equal(manifest.version, 2);
  assert.equal(manifest.dimensions, 256);
  assert.equal(manifest.revision, assets.model_export_sha256);
  for (const [name, expected] of Object.entries(assets.sha256)) {
    const bytes = read(`vendor/${name}`);
    assert.equal(sha(bytes), expected, name);
    assert.ok(bytes.byteLength <= 64 * 1024 ** 2, name);
  }
  const model = `vendor/models/${manifest.model}`;
  const config = json(`${model}/config.json`);
  assert.equal(config.vision_config, null);
  assert.equal(config.audio_config, null);
  const exported = json(`${model}/export.json`);
  assert.equal(sha(read(`${model}/export.json`)), manifest.model_export_sha256);
  assert.equal(exported.matmul_block_size, 16);
  const graph = json('data/graph.json');
  const reports = graph.reports ?? Array.from({length:graph.meta.n_report_shards},
    (_, i) => json(`data/reports/${i}.json`)).flat();
  const ids = reports.map(r => r.id || `${({0:'ASRS',1:'NTSB',2:'ASRSN'})[r.src ?? 0]}:${r.acn}`);
  assert.equal(new Set(ids).size, manifest.reports);
  assert.equal(sha(ids.join('\n')), manifest.ids_sha256);
  let next = 0;
  const blocks = manifest.shards.map(shard => {
    const body = read(`data/semantic/${shard.file}`);
    assert.equal(shard.start, next);
    assert.equal(body.length, shard.rows * manifest.dimensions);
    assert.equal(sha(body), shard.sha256);
    next += shard.rows;
    return body;
  });
  assert.equal(next, manifest.reports);
  const packed = new Int8Array(Buffer.concat(blocks));
  const lengths = norms(packed, manifest.dimensions);
  const probes = json('tests/fixtures/gemma-parity.json');
  assert.equal(probes.model_export_sha256, manifest.model_export_sha256);
  for (const probe of probes.probes) {
    const first = rank(packed, lengths, probe.vector, null, 1)[0];
    assert.equal(ids[first[0]], probe.top_ids[0], probe.query);
    assert.ok(Math.abs(first[1] - probe.scores[0]) < 1e-5, probe.query);
  }
});
