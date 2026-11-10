const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const path=require('node:path');
const C=require('../assets/pigmeup-crypto.js');
const P=require('../assets/pigmeup-model.js');
test('browser and local AES-GCM protocol interoperate without exposing key in path',async()=>{
 const secret=crypto.randomBytes(32).toString('base64url'),ctx=await C.context(secret),iv=crypto.randomBytes(12);
 const cipher=crypto.createCipheriv('aes-256-gcm',Buffer.from(secret,'base64url'),iv);cipher.setAAD(Buffer.from('PigMeUp/private-inbox/v1'));
 const plain=Buffer.from(JSON.stringify({version:1,items:[{raw:'私人的羅馬筆記'}]}));
 const data=Buffer.concat([cipher.update(plain),cipher.final(),cipher.getAuthTag()]);
 const envelope={version:1,iv:iv.toString('base64'),data:data.toString('base64')};
 assert.equal(C.decode(await C.decrypt(ctx,envelope)),plain.toString());
 assert.equal(ctx.id,crypto.createHash('sha256').update('PigMeUp/v1/'+secret).digest('hex'));
 assert(!C.url(ctx,'index').includes(secret));assert(C.url(ctx,'index').includes('/pigmeupPrivate/v1/'));
 await assert.rejects(C.decrypt(await C.context(crypto.randomBytes(32).toString('base64url')),envelope));
 assert.throws(()=>C.url(ctx,'../trips'));assert.equal(C.safeURL('javascript:alert(1)'),'');
});
test('TG inbox is isolated from itinerary and existing planning store',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../explore.html'),'utf8');
 assert(html.includes('<pig-inbox'));assert(html.includes('pigmeup-crypto.js'));
 const script=fs.readFileSync(path.join(__dirname,'../assets/pigmeup-inbox.js'),'utf8');
 assert(!script.includes('v-html'));assert(!script.includes('db.ref'));assert(!script.includes('ExploreStore'));assert(!script.includes('store.edit'));
 assert(script.includes('未設定通知'));assert(script.includes('type="password"'));assert(script.includes('URL.revokeObjectURL'));
 for(const file of ['pigmeup-crypto.js','pigmeup-model.js','pigmeup-inbox.js','explore.js'])new vm.Script(fs.readFileSync(path.join(__dirname,'../assets',file),'utf8'));
});
test('rice cake notes are readable food cards without changing original data',()=>{
 const item={id:'1',raw:'📍店名：元祖老奶奶麻糬年糕 할머니떡집\n▪地址：제주특별자치도 서귀포시 중앙로42번길 24',classification:{country:'韓國',city:'濟州島',category:'待分類',method:'keywords'},urls:[],media:[]};
 const before=structuredClone(item),card=P.view(item,{countries:[]});
 assert.equal(card.title,'元祖老奶奶麻糬年糕 할머니떡집');assert.equal(card.category,'美食');assert.equal(card.subtag,'小吃／甜點');
 assert.equal(card.countryId,'KOR');assert.equal(card.mapQuery,'제주특별자치도 서귀포시 중앙로42번길 24');
 assert.equal(card.summary,'');assert.deepEqual(item,before);
 item.classification.category='購物';item.classification.method='manual';assert.equal(P.view(item,{countries:[]}).category,'購物');
});
test('reminder cards separate title and date without duplicating place or inventing a deadline',()=>{
 const card=P.view({id:'2',raw:'梵蒂岡博物館 2027/2月搶票',classification:{country:'梵蒂岡',city:'梵蒂岡',category:'準備提醒'}},{countries:[]});
 assert.equal(card.title,'梵蒂岡博物館');assert.equal(card.dateHint,'2027/02');assert.equal(card.location,'梵蒂岡');
 assert.equal(card.countryId,'ITA');assert.equal(P.dateHint('2 月上旬開始留意門票'),'2 月上旬 · 年份待確認');
});
test('map collection counts combine private and manual views, never writes them to shared storage',()=>{
 const world={countries:[{id:'KOR',name:'韓國',center:[1,2]},{id:'ITA',name:'義大利',center:[3,4]}]};
 const manual=P.manual({id:'custom-1',country:'ITA',name:'手動收藏',createdAt:1},{name:'手動收藏',country:'ITA'});
 const tg=P.view({id:'2',raw:'羅馬咖啡',classification:{country:'義大利',category:'咖啡'}},world);
 assert.equal(P.counts([manual,tg],world)[0].count,2);assert.equal(manual.source,'manual');assert.equal(tg.source,'telegram');
 const html=fs.readFileSync(path.join(__dirname,'../explore.html'),'utf8'),script=fs.readFileSync(path.join(__dirname,'../assets/explore.js'),'utf8');
 assert(html.includes('collectionCountries'));assert(html.includes('@click.stop="selectCountry(c.id)"'));assert(script.includes("tab.value='saved'"));
 assert(!script.includes("{id:'inbox'"));assert(!script.includes('s.entries[item.id]'));assert(html.includes(':cards="collectionIdeas"'));
});
