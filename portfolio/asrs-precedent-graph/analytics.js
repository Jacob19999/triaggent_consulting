/* Investigator-oriented descriptive analytics over the exported report catalogue. */
(function (root) {
  'use strict';
  const source = r => r.src === 1 ? 'NTSB' : 'ASRS';
  const count = n => n.toLocaleString();
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function select(reports, filters) {
    const words = filters.query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return reports.filter(r => (!filters.source || source(r) === filters.source)
      && +r.date.slice(0,4) >= filters.from && +r.date.slice(0,4) <= filters.to
      && filters.factors.every(f => r.f.includes(f))
      && words.every(w => r.hay.includes(w)));
  }
  function aggregate(reports, facets) {
    const totals = {ASRS:0, NTSB:0}, years = new Map(), factors = new Map();
    const coverage = {ASRS:{}, NTSB:{}};
    for (const r of reports) {
      const s = source(r); totals[s]++;
      const year = r.date.slice(0,4);
      if (!years.has(year)) years.set(year,[0,0,0]);
      years.get(year)[r.src || 0]++;
      const layers = new Set();
      for (const id of new Set(r.f)) {
        if (facets[id].src === 'llm') continue;
        layers.add(facets[id].layer);
        if (!factors.has(id)) factors.set(id,{id,ASRS:0,NTSB:0});
        factors.get(id)[s]++;
      }
      for (const layer of layers) coverage[s][layer] = (coverage[s][layer] || 0) + 1;
    }
    return {totals, years, factors, coverage};
  }
  function matrix(reports, phases, events) {
    const cells = phases.map(() => events.map(() => 0));
    for (const r of reports) {
      const fs = new Set(r.f);
      phases.forEach((p,i) => { if (fs.has(p)) events.forEach((e,j) => { if (fs.has(e)) cells[i][j]++; }); });
    }
    return cells;
  }
  function csv(rows) {
    const quote = s => '"' + String(s ?? '').replace(/"/g,'""') + '"';
    return rows.map(row => row.map(quote).join(',')).join('\r\n');
  }
  function mount(host, reports, facets, callbacks) {
    const years = [...new Set(reports.map(r => +r.date.slice(0,4)))].sort((a,b)=>a-b);
    const state = {source:'',from:years[0],to:years.at(-1),query:'',factors:[],layer:'event',sort:'newest'};
    const names = {event:'Event type',phase:'Flight phase',system:'Aircraft system',human:'Human factors',weather:'Weather & light',response:'Response & outcome'};
    const label = id => facets[id].label.replace(/^(Aircraft|Location): /,'');
    let cohort = reports, exportUrl = null;
    host.innerHTML = `<div class="an-shell"><header class="an-heading"><div><p class="label">Collection analysis / ASRS + NTSB</p><h2>Safety analytics</h2><p>Find recurring patterns, narrow an investigation and return to the source reports.</p></div><button class="btn ghost" data-an="export">Export cohort CSV ↓</button></header>
      <div class="an-controls"><label>Reporting system<select id="an-source"><option value="">ASRS + NTSB</option> <option>ASRS</option><option>NTSB</option></select></label><label>From year<select id="an-from">${years.map(y=>`<option>${y}</option>`).join('')}</select></label><label>To year<select id="an-to">${years.map(y=>`<option ${y===state.to?'selected':''}>${y}</option>`).join('')}</select></label><label class="an-query">Search summaries & metadata<input id="an-query" type="search" placeholder="e.g. fuel leak, runway excursion, aircraft or case ID"></label><button class="btn ghost" data-an="reset">Reset</button></div>
      <div id="an-export-status" role="status"></div><div id="an-chips" class="an-chips"></div><p class="an-caveat">Collection counts, not accident rates. ASRS is voluntary reporting; NTSB is an investigation collection. Coverage differs by source and year. Multiple reports can describe one incident; the latest year may be incomplete.</p>
      <div id="an-content"></div></div>`;
    const $ = s => host.querySelector(s);
    function refresh() {
      if(exportUrl) { URL.revokeObjectURL(exportUrl); exportUrl=null; $('#an-export-status').replaceChildren(); }
      cohort = select(reports,state);
      const a = aggregate(cohort,facets), total = cohort.length;
      const top = (layer,n) => [...a.factors.values()].filter(f=>facets[f.id].layer===layer).sort((x,y)=>(y.ASRS+y.NTSB)-(x.ASRS+x.NTSB)||x.id-y.id).slice(0,n);
      const pct = (n,d) => d ? (100*n/d).toFixed(1)+'%' : '—';
      $('#an-chips').innerHTML = state.factors.map(id=>`<button data-an="remove" data-id="${id}" class="chip">${esc(label(id))} ×</button>`).join('');
      const phaseN = (a.coverage.ASRS.phase||0)+(a.coverage.NTSB.phase||0);
      const kpis = [[count(total),'Reports in cohort'],[count(a.totals.ASRS),'ASRS reports'],[count(a.totals.NTSB),'NTSB investigations'],[pct(phaseN,total),'With a coded flight phase']];
      const maxYear = Math.max(1,...[...a.years.values()].map(v=>v.reduce((x,y)=>x+y,0)));
      const bars = years.map(y=>{
        const v=a.years.get(String(y))||[0,0,0];
        return `<button class="an-year" data-an="year" data-year="${y}" title="${y}: ${v[0]} ASRS coded; ${v[2]} ASRS narrative only; ${v[1]} NTSB"><span class="an-year-stack">${[0,2,1].map(s=>`<i class="src-${s}" style="height:${100*v[s]/maxYear}%"></i>`).join('')}</span><span>${y}</span><b>${count(v.reduce((x,y)=>x+y,0))}</b></button>`;
      }).join('');
      const factorRows=top(state.layer,8).map(f=>`<button class="an-factor" data-an="factor" data-id="${f.id}"><span>${esc(label(f.id))}</span><span class="an-track"><i style="width:${a.totals.ASRS?100*f.ASRS/a.totals.ASRS:0}%"></i></span><small>${count(f.ASRS)} · ${pct(f.ASRS,a.totals.ASRS)}</small><span class="an-track ntsb"><i style="width:${a.totals.NTSB?100*f.NTSB/a.totals.NTSB:0}%"></i></span><small>${count(f.NTSB)} · ${pct(f.NTSB,a.totals.NTSB)}</small></button>`).join('');
      const phases=top('phase',5).map(f=>f.id), events=top('event',5).map(f=>f.id), cells=matrix(cohort,phases,events);
      const maxCell=Math.max(1,...cells.flat());
      const heat = phases.length && events.length ? `<div class="an-table-wrap"><table class="an-matrix"><caption class="sr-only">Report counts for each flight-phase and event pair</caption><thead><tr><th>Phase / event</th>${events.map(e=>`<th>${esc(label(e))}</th>`).join('')}</tr></thead><tbody>${phases.map((p,i)=>`<tr><th>${esc(label(p))}</th>${events.map((e,j)=>`<td><button data-an="cell" data-phase="${p}" data-event="${e}" ${cells[i][j]?'':'disabled'} style="--heat:${cells[i][j]/maxCell}" aria-label="${esc(label(p)+' and '+label(e)+': '+cells[i][j]+' reports')}">${count(cells[i][j])}</button></td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<p class="hint">No coded flight-phase / event pairs in this cohort.</p>';
      const coverageRows=Object.entries(names).map(([l,name])=>`<tr><th>${name}</th><td>${pct(a.coverage.ASRS[l]||0,a.totals.ASRS)} <small>(${count(a.coverage.ASRS[l]||0)})</small></td><td>${pct(a.coverage.NTSB[l]||0,a.totals.NTSB)} <small>(${count(a.coverage.NTSB[l]||0)})</small></td></tr>`).join('');
      const queue=cohort.slice().sort((x,y)=>state.sort==='oldest'?x.date.localeCompare(y.date):y.date.localeCompare(x.date)).slice(0,30);
      $('#an-content').innerHTML=`<div class="an-kpis">${kpis.map(([v,l])=>`<div><strong>${v}</strong><span>${l}</span></div>`).join('')}</div>
        ${!total?'<div class="an-empty"><h3>No reports match this cohort</h3><p>Remove a factor or broaden the year range or search.</p></div>':''}
        <div class="an-grid"><section class="an-panel an-wide"><div class="an-panel-head"><div><p class="label">01 / Time & coverage</p><h3>Reports by recorded year</h3></div><div class="an-legend"><span><i class="src-0"></i>ASRS coded</span><span><i class="src-2"></i>ASRS narrative only ≈</span><span><i class="src-1"></i>NTSB</span></div></div><div class="an-years">${bars}</div><p class="hint">Click a year to isolate it. ≈ Newer ASRS dates are estimated from report identifiers. Changes can reflect collection coverage rather than changes in safety.</p></section>
        <section class="an-panel an-wide"><div class="an-panel-head"><div><p class="label">02 / Recurring patterns</p><h3>What is appearing in each source?</h3></div><label>Factor category<select id="an-layer">${Object.entries(names).map(([id,n])=>`<option value="${id}" ${state.layer===id?'selected':''}>${n}</option>`).join('')}</select></label></div><div class="an-factor-head"><span>Most frequent coded factors</span><span>ASRS · % of ${count(a.totals.ASRS)} reports</span><span>NTSB · % of ${count(a.totals.NTSB)} reports</span></div>${factorRows||'<p class="hint">No coded factors in this category.</p>'}<p class="hint">Click a factor to narrow the cohort. Percentages use all selected reports in each source, including uncoded reports. A report can have several factors; bars need not sum to 100%. Identical labels are aligned; different taxonomies are retained.</p></section>
        <section class="an-panel an-wide"><p class="label">03 / Investigation leads</p><h3>Where do event types meet flight phases?</h3>${heat}<p class="hint">Five most frequent phases and events in this cohort. Cells count reports containing both codes, not inferred causal relationships. Click a cell to require both factors.</p></section>
        <section class="an-panel"><p class="label">04 / Evidence availability</p><h3>How complete is the coding?</h3><div class="an-table-wrap"><table class="an-coverage"><thead><tr><th>Category</th><th>ASRS</th><th>NTSB</th></tr></thead><tbody>${coverageRows}</tbody></table></div><p class="hint">Percentage with at least one source-coded factor in the category. No code does not mean the condition was absent. AI-inferred factors are excluded from all charts.</p></section>
        <section class="an-panel"><p class="label">Investigator’s workflow</p><h3>Turn a pattern into a reading list</h3><ol class="an-workflow"><li>Select a period and reporting system.</li><li>Search a mechanism or equipment issue, then add coded factors.</li><li>Use the matrix to isolate a phase / event combination.</li><li>Read source narratives and compare cross-source analogues.</li></ol><button class="btn" data-an="inspect" ${total?'':'disabled'}>Inspect ${count(total)} reports on the map →</button><p class="hint">No exposure data, validated cross-source incident matches or reporting-propensity adjustments are included.</p></section>
        <section class="an-panel an-wide"><div class="an-panel-head"><div><p class="label">05 / Source evidence</p><h3>Report reading queue</h3></div><label>Order<select id="an-sort"><option value="newest" ${state.sort==='newest'?'selected':''}>Newest first</option><option value="oldest" ${state.sort==='oldest'?'selected':''}>Oldest first</option></select></label></div><p class="hint">Showing ${queue.length} of ${count(total)} matching reports. Open a report to read its original narrative; CSV exports the entire cohort.</p><div class="an-queue">${queue.map(r=>`<button data-an="report" data-id="${r.i}"><span class="mono ${r.src===1?'ntsb':''}">${source(r)} ${esc(r.acn)}</span><span>${r.de?'≈':''}${esc(r.date)} · ${esc(r.aircraft||'Aircraft not recorded')}</span><p>${esc((r.summary||r.synopsis).slice(0,260))}</p><b>Read report →</b></button>`).join('')}</div></section></div>`;
      $('#an-layer').onchange=e=>{state.layer=e.target.value;refresh();};
      $('#an-sort').onchange=e=>{state.sort=e.target.value;refresh();};
    }
    let timer;
    $('#an-query').oninput=e=>{state.query=e.target.value;clearTimeout(timer);timer=setTimeout(refresh,160);};
    $('#an-source').onchange=e=>{state.source=e.target.value;refresh();};
    $('#an-from').onchange=e=>{state.from=+e.target.value;state.to=Math.max(state.from,state.to);$('#an-to').value=state.to;refresh();};
    $('#an-to').onchange=e=>{state.to=+e.target.value;state.from=Math.min(state.from,state.to);$('#an-from').value=state.from;refresh();};
    host.onclick=e=>{
      const b=e.target.closest('[data-an]');if(!b)return;
      const act=b.dataset.an, id=+b.dataset.id;
      if(act==='inspect'||act==='export')cohort=select(reports,state);
      if(act==='factor') {if(!state.factors.includes(id))state.factors.push(id);refresh();}
      if(act==='cell') {for(const f of [+b.dataset.phase,+b.dataset.event])if(!state.factors.includes(f))state.factors.push(f);refresh();}
      if(act==='remove'){state.factors=state.factors.filter(f=>f!==id);refresh();}
      if(act==='year'){state.from=state.to=+b.dataset.year;$('#an-from').value=state.from;$('#an-to').value=state.to;refresh();}
      if(act==='reset'){state.source='';state.from=years[0];state.to=years.at(-1);state.query='';state.factors=[];$('#an-source').value='';$('#an-from').value=state.from;$('#an-to').value=state.to;$('#an-query').value='';refresh();}
      if(act==='report')callbacks.report(id);
      if(act==='inspect')callbacks.inspect(cohort.map(r=>r.i));
      if(act==='export'){
        clearTimeout(timer); refresh();
        // Spreadsheet readers must treat source text as text, including formula-like prefixes.
        const safe=s=>/^[=+\-@\t\r]/.test(String(s||''))?"'"+s:s;
        const rows=[['document_id','source','display_id','date','date_estimated','aircraft','summary','coded_factors'],...cohort.map(r=>[r.id||r.acn,source(r),r.acn,r.date,r.de?true:false,r.aircraft,r.summary||r.synopsis,r.f.filter(f=>facets[f].src!=='llm').map(f=>facets[f].label).join('; ')].map(safe))];
        if(exportUrl)URL.revokeObjectURL(exportUrl);
        exportUrl=URL.createObjectURL(new Blob(['\uFEFF'+csv(rows)],{type:'text/csv;charset=utf-8'}));
        const a=document.createElement('a');a.href=exportUrl;a.download='aviation-report-cohort.csv';a.textContent=`Save CSV · ${count(cohort.length)} reports ↓`;a.className='btn ghost';
        $('#an-export-status').replaceChildren(a);
        a.click();
      }
    };
    refresh();
  }
  const api={select,aggregate,matrix,csv,mount};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SafetyAnalytics=api;
})(typeof globalThis!=='undefined'?globalThis:this);
