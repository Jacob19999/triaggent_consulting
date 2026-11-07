const {test}=require('node:test');
const assert=require('node:assert/strict');
const A=require('../analytics.js');
const facets=[{layer:'phase',src:'asrs'},{layer:'event',src:'shared'},{layer:'human',src:'llm'}];
const reports=[{src:0,date:'2020-01',f:[0,0,1,2],hay:'fuel leak engine'},{src:2,date:'2021-03',f:[],hay:'fuel pump'},{src:1,date:'2020-02',f:[1],hay:'fuel leak'}];
test('counts reports once per factor and category; excludes AI coding; keeps uncoded denominator',()=>{
 const a=A.aggregate(reports,facets);
 assert.deepEqual(a.totals,{ASRS:2,NTSB:1});
 assert.equal(a.factors.get(0).ASRS,1);
 assert.equal(a.factors.get(1).NTSB,1);
 assert.equal(a.factors.has(2),false);
 assert.equal(a.coverage.ASRS.phase,1);
 assert.deepEqual(a.years.get('2020'),[1,1,0]);
});
test('cohort intersects source, years, query and every factor',()=>{
 const f={source:'ASRS',from:2020,to:2021,query:'fuel leak',factors:[0,1]};
 assert.deepEqual(A.select(reports,f),[reports[0]]);
 assert.equal(A.select(reports,{...f,from:2021}).length,0);
 assert.deepEqual(A.select(reports,{...f,source:'NTSB',factors:[1]}),[reports[2]]);
});
test('matrix counts a multi-coded report once per cell',()=>{
 assert.deepEqual(A.matrix(reports,[0],[1]),[[1]]);
 assert.deepEqual(A.matrix([], [0],[1]),[[0]]);
});
test('CSV preserves embedded commas, quotes and newlines',()=>{
 assert.equal(A.csv([['a,b','a"b','a\nb']]),'"a,b","a""b","a\nb"');
});
