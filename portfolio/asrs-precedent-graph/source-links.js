/* Cross-source similarity and recorded NTSB injury codes for the Source map only. */
(function(root){
  'use strict';
  function severity(report,facets){
    if(report.src!==1)return {level:0,label:'Injury severity not encoded for ASRS',damage:''};
    const labels=new Set(report.f.filter(i=>facets[i].src!=='llm').map(i=>facets[i].label));
    const injury=[['Fatal injuries',3],['Serious injuries',2],['Minor injuries',1]].find(([s])=>labels.has(s));
    return {level:injury?.[1]||0,label:injury?.[0]||'Injury severity not recorded in this export',damage:labels.has('Aircraft destroyed')?'Aircraft destroyed':labels.has('Substantial damage')?'Substantial damage':''};
  }
  function links(reports,threshold,allowed=null){
    const pairs=new Map();
    reports.forEach((r,i)=>{
      if(allowed&&!allowed.has(i))return;
      for(const [j,score] of r.cross||[]){
        if(!reports[j]||j===i||!Number.isFinite(score)||score<threshold||score>1||(allowed&&!allowed.has(j)))continue;
        if((r.src===1)===(reports[j].src===1))continue;
        const a=Math.min(i,j),b=Math.max(i,j),key=a*reports.length+b;
        const old=pairs.get(key);
        if(!old||score>old.score)pairs.set(key,{a,b,score});
      }
    });
    const edges=[...pairs.values()].sort((a,b)=>b.score-a.score||a.a-b.a||a.b-b.b);
    return {edges,participants:new Set(edges.flatMap(e=>[e.a,e.b]))};
  }
  const api={severity,links};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SourceLinks=api;
})(typeof globalThis!=='undefined'?globalThis:this);
