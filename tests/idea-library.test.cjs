const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const L=require('../assets/idea-library-model.js');
const base={source:'telegram',countryId:'KOR',urls:[],media:[],raw:'',createdAt:'2026-11-11'};
test('country/city scopes and nationwide wishes remain distinct, all paths point to one record',()=>{
 const cards=[{...base,id:'market',title:'偶來市場',category:'美食',city:'濟州島',summary:'糖餅'},{...base,id:'wish',title:'糖餅',category:'美食',scope:'country'},{...base,id:'duck',title:'오성가든',category:'美食',city:'釜山'},{...base,id:'rome',countryId:'ITA',title:'羅馬競技場',category:'景點',city:'羅馬'}].map(L.present);
 assert.equal(L.filter(cards,{country:'KOR',scope:'濟州島',group:'景點',subtype:'市場'})[0].id,'market');
 assert.equal(L.filter(cards,{country:'KOR',scope:'濟州島',group:'美食'})[0].id,'market');
 assert.deepEqual(L.filter(cards,{country:'KOR',scope:'@country'}).map(c=>c.id),['wish']);assert.equal(L.filter(cards,{country:'KOR',scope:'濟州島'}).length,1);
 assert.equal(L.cityFor({city:'濟州島・咸德'}),'濟州島');assert.equal(L.cityFor({scope:'country',city:'釜山'}),'');
});
test('legacy manual content and unknown places remain reachable without mutation',()=>{
 const raw={...base,id:'manual',source:'manual',title:'自己的收藏',category:'購物',location:'濟州島',summary:'原本備註'};const before=structuredClone(raw),card=L.present(raw);assert.equal(card.city,'濟州島');assert.deepEqual(raw,before);
 const unknown=L.present({...base,id:'place',title:'店名',mapQuery:'店名 韓國',category:'美食'});assert.equal(L.scopes([unknown])[0].id,'@places');
});
test('new UI is read-only, hides empty fields, has no instructional or mock copy',()=>{
 for(const f of ['idea-library-model.js','idea-library.js'])new vm.Script(fs.readFileSync('assets/'+f,'utf8'));
 const js=fs.readFileSync('assets/idea-library.js','utf8');assert.ok(!/v-html|ExploreStore|store\.edit|db\.ref|新增體驗|資料只存一份|示意|城市未定/.test(js));assert.ok(js.includes('v-if="selected.experiences.length"'));assert.ok(js.includes('v-if="selected.summary"'));assert.ok(js.includes('v-if="selected.address"'));assert.ok(js.includes('imageDialog.value.showModal()'));
 const html=fs.readFileSync('explore.html','utf8');assert.ok(html.indexOf('idea-library.js')<html.indexOf('assets/explore.js'));assert.ok(!html.includes('＋ 收藏一個想法</button>'));
 const css=fs.readFileSync('assets/idea-library.css','utf8');assert.ok(css.includes('@media(max-width:700px)'));assert.ok(css.includes('overflow-wrap:anywhere'));assert.ok(css.includes('min-height:48px'));
});
