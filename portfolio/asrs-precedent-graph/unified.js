/* Shared search and provenance rules for the ASRS / NTSB explorer. */
(function (root) {
  'use strict';
  const family = r => r.src === 1 ? 'NTSB' : 'ASRS';
  const identity = r => r.id || `${r.src === 1 ? 'NTSB' : r.src === 2 ? 'ASRSN' : 'ASRS'}:${r.acn}`;
  const summaryLabel = (r, model) => r.synopsis_kind === 'generated' || r.src === 2
    ? `AI summary · ${model || 'local model'}`
    : r.src === 1 ? 'NTSB probable cause' : 'ASRS analyst synopsis';

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
  const api = { family, identity, summaryLabel, normaliseFactors, crossMatches, searchScore };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.UnifiedReports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
