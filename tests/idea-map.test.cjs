const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const G=require('../assets/idea-map-model.js');const C=require('../assets/pigmeup-crypto.js');
test('coordinate parsing excludes viewport centres, dates, invalid or spoofed URLs',()=>{
 assert.equal(G.explicit({raw:'2027/2月搶票',urls:[]}),null);
 assert.equal(G.explicit({urls:['https://maps.google.com/@33.2,126.5,17z']}),null);
 assert.equal(G.explicit({urls:['nmap://place']}),null);
 assert.equal(G.explicit({urls:['https://google.evil.com/?q=33.2,126.5']}),null);
 assert.equal(G.explicit({raw:'座標：33.25,126.56'}).lat,33.25);
 assert.equal(G.explicit({urls:['https://www.google.com/maps/search/?api=1&query=33.25,126.56']}).lon,126.56);
 assert.equal(G.valid({lat:'',lon:''}),false);assert.equal(G.valid({lat:91,lon:4}),false);
});
test('stale address placements are not silently reused and regional overview creates no fake pins',()=>{
 const card={id:'tg-msg-1',address:'old address',countryId:'KOR',location:'韓國・濟州島',urls:[]};
 const places={'tg-msg-1':{lat:33.25,lon:126.56,query:'old address'}};
 assert.equal(G.point(card,places).lat,33.25);card.address='new address';assert.equal(G.point(card,places),null);
 assert.equal(G.region([card]).label,'濟州島區域總覽・不是店家位置');assert.equal(G.point(card,{}),null);
});
test('official same-name reference is a candidate, not an automatic store pin',()=>{
 const card={id:'tg-msg-3',countryId:'KOR',title:'元祖老奶奶麻糬年糕 할머니떡집',address:'제주특별자치도 서귀포시 중앙로42번길 24',urls:[]};
 const refs=G.references(card);assert.equal(refs.length,1);assert.match(refs[0].address,/중앙로79번길 12/);assert.match(refs[0].source,/需核對/);assert.equal(G.point(card,{}),null);
});
test('geocoder candidates are explicit, country-filtered and queried only on demand',async()=>{
 let calls=0;const card={id:'1',countryId:'KOR',raw:'PRIVATE_NOTE_DO_NOT_SEND',address:'test address'};
 const fake=async(url,options)=>{calls++;assert(!url.includes('PRIVATE_NOTE'));assert(url.includes('countrycode=KR'));return {ok:true,json:async()=>({features:[{geometry:{type:'Point',coordinates:[126.56,33.25]},properties:{name:'候選餐館',countrycode:'KR'}},{geometry:{type:'Point',coordinates:[12,41]},properties:{name:'別國',countrycode:'IT'}}]})};};
 const found=await G.search(card,'test address',fake);assert.equal(calls,1);assert.equal(found.length,1);assert.equal(found[0].name,'候選餐館');
 await G.search(card,'test address',fake);assert.equal(calls,1,'repeat queries cached');
});
test('encrypted per-place writes use safe namespace and reject stale edits',async()=>{
 const secret=require('node:crypto').randomBytes(32).toString('base64url'),ctx=await C.context(secret),originalFetch=global.fetch;let remote=null,writes=0;
 global.fetch=async(url,options={})=>{assert(url.includes('/pigmeupPrivate/v1/'));assert(/\/placements\/[a-f0-9]{64}\.json$/.test(url));if(options.method==='PUT'){writes++;assert.equal(options.headers['if-match'],'"etag"');assert(!options.body.includes('private address'));remote=JSON.parse(options.body);return {ok:true,status:200};}return new Response(JSON.stringify(remote),{status:200,headers:{etag:'"etag"'}});};
 try{const p=await C.writePlacement(ctx,'tg-msg-1',{lat:33.25,lon:126.56,query:'private address'},null);assert.equal(writes,1);assert.equal(JSON.parse(C.decode(await C.decrypt(ctx,remote))).id,'tg-msg-1');await assert.rejects(C.writePlacement(ctx,'tg-msg-1',{lat:33.26,lon:126.56,query:'private address'},null),/另一台裝置/);assert.equal(writes,1);}finally{global.fetch=originalFetch;}
});
test('map UI does not batch geocode, expose raw HTML, or mutate trip storage',()=>{
 const script=fs.readFileSync(path.join(__dirname,'../assets/idea-place-map.js'),'utf8');assert(!script.includes('v-html'));assert(!script.includes('ExploreStore'));assert(!script.includes('trips/'));assert(script.includes("referrerPolicy:'origin'"));assert(script.includes('G.search(card,query.value)'));assert(script.includes('使用者釘選／確認'));
 for(const file of ['idea-map-model.js','idea-place-map.js','pigmeup-inbox.js','pigmeup-crypto.js'])new vm.Script(fs.readFileSync(path.join(__dirname,'../assets',file),'utf8'));
});
