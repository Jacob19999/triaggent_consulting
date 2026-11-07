/* Shared search and provenance rules for the ASRS / NTSB explorer. */
(function (root) {
  'use strict';
  const family = r => r.src === 1 ? 'NTSB' : 'ASRS';
  const identity = r => r.id || `${r.src === 1 ? 'NTSB' : r.src === 2 ? 'ASRSN' : 'ASRS'}:${r.acn}`;
  const fatalityBuckets = [
    {id:'0', label:'0 fatalities'}, {id:'1', label:'1 fatality'},
    {id:'2-5', label:'2–5 fatalities'}, {id:'6-10', label:'6–10 fatalities'},
    {id:'11+', label:'11+ fatalities'}, {id:'unknown', label:'Unknown / not recorded'}
  ];
  function fatalityCount(report) {
    // ASRS has no comparable event-level count. Never coerce missing counts to zero.
    return report.src === 1 && Number.isSafeInteger(report.fatalities) && report.fatalities >= 0
      ? report.fatalities : null;
  }
  function fatalityBucket(report) {
    const n = fatalityCount(report);
    return n === null ? 'unknown' : n <= 1 ? String(n) : n <= 5 ? '2-5' : n <= 10 ? '6-10' : '11+';
  }
  const matchesFatalities = (report, bucket) => !bucket || fatalityBucket(report) === bucket;
  const summaryLabel = (r, model) => r.synopsis_kind === 'generated' || r.src === 2
    ? `AI summary · ${model || 'local model'}`
    : r.src === 1 ? 'NTSB probable cause' : 'ASRS analyst synopsis';

  function reportSummaries(r, model) {
    const missingCause = r.src === 1 && r.synopsis_kind === 'generated';
    const blocks = [{
      label: missingCause ? 'NTSB probable cause' : summaryLabel(r, model),
      text: missingCause ? 'Probable cause unavailable in source' : r.synopsis,
      ai: false
    }];
    if (r.summary && (r.src === 1 || (r.synopsis_kind !== 'generated' && r.src !== 2))) {
      blocks.push({label: `AI narrative summary · ${model || 'local model'}`, text: r.summary, ai: true});
    }
    return blocks;
  }

  // Only identical named concepts within a layer bridge analyst taxonomies. Keep each
  // report's original coding source; never merge an LLM inference into an official code.
  function normaliseFactors(data) {
    const keys = new Map(), facets = [], remap = [];
    data.facets.forEach((f, i) => {
      const key = `${f.layer}|${f.label.trim().toLowerCase()}|${f.src === 'llm' ? 'llm' : 'coded'}`;
      if (!keys.has(key)) {
        keys.set(key, facets.length);
        facets.push({ ...f, id: facets.length, df: 0, sources: [] });
      }
      const id = keys.get(key), merged = facets[id];
      remap[i] = id;
      if (!merged.sources.includes(f.src || 'asrs')) merged.sources.push(f.src || 'asrs');
    });
    for (const r of data.reports) {
      const evidence = {};
      r.f.forEach(f => { (evidence[remap[f]] ||= []).push(data.facets[f].src || 'asrs'); });
      r.f = [...new Set(r.f.map(f => remap[f]))];
      r.evidence = evidence;
      if (r.q) r.q = Object.fromEntries(Object.entries(r.q).map(([f, quote]) => [remap[+f], quote]));
      r.f.forEach(f => facets[f].df++);
    }
    for (const f of facets) {
      f.idf = Math.log((data.reports.length + 1) / (f.df + 1)) + 1;
      if (f.sources.length > 1) f.src = 'shared';
    }
    return facets;
  }

  function crossMatches(reports, i, allowed = null) {
    const seen = new Set(), source = reports[i];
    return (source.cross || []).filter(([j, score]) => {
      if (!reports[j] || seen.has(j) || j === i || score <= 0 || family(reports[j]) === family(source)) return false;
      seen.add(j);
      return !allowed || allowed.has(j);
    }).sort((a, b) => b[1] - a[1]);
  }

  function searchScore(report, expressions, query) {
    if ([report.acn, identity(report)].some(id => id.toLowerCase() === query.toLowerCase())) return 1000;
    // The common summary has equal weight for both sources. Analyst-code density is
    // deliberately not a tie-breaker: narrative-only reports have fewer coded fields.
    return expressions.reduce((score, re) => score
      + (re.test((report.summary || '').toLowerCase()) ? 4 : 0)
      + (re.test(report.syn) ? 2 : 0)
      + (re.test((report.aircraft || '').toLowerCase()) ? 1 : 0), 0);
  }
  const api = { family, identity, summaryLabel, reportSummaries, normaliseFactors, crossMatches, searchScore,
    fatalityBuckets, fatalityCount, fatalityBucket, matchesFatalities };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.UnifiedReports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
