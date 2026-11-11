const test=require('node:test'),assert=require('node:assert/strict');
const M=require('../assets/pigmeup-model.js'),G=require('../assets/idea-map-model.js');
const items=[1,2,3].map(n=>({id:'msg-'+n,raw:'原文'+n,classification:{country:'韓國',city:'',category:'待分類'},urls:[],media:[],sender:'旅人',createdAt:'2026-11-11'}));
const group={anchorId:'msg-1',sources:[{id:'msg-1'},{id:'msg-2'}],title:'偶來市場',country:'韓國',city:'濟州島',category:'美食',summary:'想吃糖餅，有廁所。',cautions:['地址待核對']};
test('organized view combines display only, retaining stable anchor, all raw and ungrouped ideas',()=>{
 const before=JSON.stringify(items),cards=M.views(items,{}, {groups:[group]});assert.equal(cards.length,2);
 const c=cards.find(c=>c.organized);assert.equal(c.id,'tg-msg-1');assert.equal(c.sourceCount,2);assert.match(c.raw,/原文1/);assert.match(c.raw,/原文2/);assert.equal(c.countryId,'KOR');assert.equal(c.category,'美食');assert.equal(JSON.stringify(items),before);
 assert.equal(M.views(items,{},null).length,3);assert.equal(M.views(items,{}, {groups:[{...group,sources:[{id:'missing'}]}]}).length,3);
});
test('consolidation retains a prior unambiguous user pin without deleting aliases',()=>{
 const c=M.views(items,{}, {groups:[group]}).find(c=>c.organized),source=c.sourceCards[1],p={query:G.queryKey(source),lat:33.2,lon:126.5};
 const placements={[source.id]:p};assert.deepEqual(G.point(c,placements),p);assert.equal(placements[source.id],p);
 placements[c.sourceCards[0].id]={query:G.queryKey(c.sourceCards[0]),lat:35,lon:127};assert.equal(G.point(c,placements),null);
});
