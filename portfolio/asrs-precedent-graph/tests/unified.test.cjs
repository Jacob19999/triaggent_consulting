const test = require('node:test');
const assert = require('node:assert/strict');
const U = require('../unified.js');

test('equivalent coded factors bridge sources but preserve provenance and separate AI', () => {
  const data = {
    facets: [
      { layer:'phase', label:'Landing', src:'asrs' },
      { layer:'phase', label:'Landing', src:'ntsb' },
      { layer:'phase', label:'Landing', src:'llm' },
      { layer:'event', label:'Landing', src:'ntsb' }
    ],
    reports: [{f:[0], q:{0:'quoted evidence'}}, {f:[1,2,3]}, {f:[0,1]}]
  };
  const factors = U.normaliseFactors(data);
  assert.equal(factors.length, 3);
  assert.equal(factors[0].df, 3);
  assert.equal(factors[0].src, 'shared');
  assert.deepEqual(data.reports[0].evidence[0], ['asrs']);
  assert.deepEqual(data.reports[1].evidence[0], ['ntsb']);
  assert.deepEqual(data.reports[2].f, [0]);
  assert.equal(data.reports[0].q[0], 'quoted evidence');
});

test('cross-source matches exclude ASRS narrative-only, invalid ids and filtered reports', () => {
  const reports = [{src:0, cross:[[0,1],[1,.9],[2,.8],[2,.7],[3,.6],[99,.5]]}, {src:2}, {src:1}, {src:1}];
  assert.deepEqual(U.crossMatches(reports, 0), [[2,.8],[3,.6]]);
  assert.deepEqual(U.crossMatches(reports, 0, new Set([3])), [[3,.6]]);
  assert.deepEqual(U.crossMatches(reports, 1), []);
});

test('generated NTSB fallbacks never claim to be official probable cause', () => {
  assert.match(U.summaryLabel({src:1, synopsis_kind:'generated'}, 'Qwen'), /^AI summary/);
  assert.equal(U.summaryLabel({src:1, synopsis_kind:'probable_cause'}), 'NTSB probable cause');
  assert.equal(U.summaryLabel({src:0}), 'ASRS analyst synopsis');
});

test('search ranks equal summaries equally regardless of source or factor count', () => {
  const a = {acn:'123', src:0, summary:'engine failure', syn:'a report', f:[0,1,2]};
  const b = {...a, acn:'ERA10LA123', src:1, f:[]};
  assert.equal(U.searchScore(a, [/engine/, /failure/], 'engine failure'), U.searchScore(b, [/engine/, /failure/], 'engine failure'));
  assert.equal(U.searchScore(b, [/era/], 'era10la123'), 1000);
});

test('namespaced identities prevent cross-source display id collisions', () => {
  assert.notEqual(U.identity({src:0, acn:'123'}), U.identity({src:1, acn:'123'}));
  assert.equal(U.identity({src:1, acn:'ERA10LA123', id:'NTSB:20100101'}), 'NTSB:20100101');
});
