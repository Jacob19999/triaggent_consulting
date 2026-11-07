const {test}=require('node:test');const assert=require('node:assert/strict');const S=require('../source-links.js');
test('links use actual cross-source cosines, deduplicate pairs and respect both cohort endpoints',()=>{
 const r=[{src:0,cross:[[1,.86],[2,.95],[0,1]]},{src:1,cross:[[0,.86],[2,.81]]},{src:2,cross:[[1,.81]]}];
 assert.deepEqual(S.links(r,.85).edges,[{a:0,b:1,score:.86}]);
 assert.deepEqual([...S.links(r,.85).participants],[0,1]);
 assert.equal(S.links(r,.8,new Set([0,2])).edges.length,0);
 assert.equal(S.links(r,.8,new Set([1,2])).edges.length,1);
});
test('injury codes retain highest recorded severity, separate damage, and leave unknowns unknown',()=>{
 const f=[{label:'Fatal injuries',src:'ntsb'},{label:'Serious injuries',src:'ntsb'},{label:'Aircraft destroyed',src:'ntsb'},{label:'Fatal injuries',src:'llm'}];
 assert.deepEqual(S.severity({src:1,f:[0,1,2]},f),{level:3,label:'Fatal injuries',damage:'Aircraft destroyed'});
 assert.equal(S.severity({src:1,f:[2,3]},f).level,0);
 assert.match(S.severity({src:1,f:[]},f).label,/not recorded/);
 assert.equal(S.severity({src:0,f:[0]},f).level,0);
});
