const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname,'../葡猪.html'),'utf8');
const section = (a,b) => html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const ref = value=>({value});
const state = {
    computed:fn=>({get value(){return fn();}}),watch(){},nextTick:fn=>fn(),URL,Intl,Date,
    vaultEntries:ref([{id:'h',type:'hotel',title:'Hotel',dateTime:'2026-10-30T15:00',bookingNumber:'ABC123',image:'data:image/png;base64,AAAA'},{id:'t',type:'ticket',title:'USJ',dateTime:'2026-10-28T09:00'},{id:'u',type:'unknown',title:'Undated'}]),
    credentialSearch:ref(''),credentialFilter:ref('all'),vaultUnlocked:ref(true),currentTripId:ref('A'),viewMode:ref('voucher'),isReadOnly:ref(false),
    credentialPreview:ref(null),credentialPreviewFit:ref(true),credentialPreviewZoom:ref(1),credentialPreviewError:ref(false),copiedCredentialId:ref(null),
    expandedCredentials:{},revealedCredentials:{},document:{activeElement:null,getElementById:()=>null},navigator:{clipboard:{writeText:async()=>{}}},clearTimeout(){},setTimeout(){},closeCredentialForm(){},prompt(){}
};
const api=vm.runInNewContext(section('const CREDENTIAL_TYPES =','const firebaseConfig =')+'\nlet credentialPreviewTrigger=null,credentialCopyTimer=null;\n'+section('const getCredentialType =','const openCredentialForm =')+'\n({credentialFilters,credentialGroups,credentialImageSrc,openCredentialPreview,closeCredentialPreview,fitCredentialPreview,zoomCredentialPreview,maskedCredentialCode})',state);
assert.equal(api.credentialFilters.value[0].count,3);
assert.deepEqual(Array.from(api.credentialGroups.value,g=>g.key),['2026-10-28','2026-10-30','undated']);
state.credentialFilter.value='hotel';assert.equal(api.credentialGroups.value.length,1);
state.credentialSearch.value='abc123';assert.equal(api.credentialGroups.value[0].entries[0].id,'h');
state.credentialSearch.value='no match';assert.equal(api.credentialGroups.value.length,0);
state.credentialFilter.value='other';state.credentialSearch.value='';assert.equal(api.credentialGroups.value[0].entries[0].id,'u');
assert.equal(api.credentialImageSrc('javascript:alert(1)'), '');assert.equal(api.credentialImageSrc('data:text/html;base64,AAAA'),'');assert.equal(api.credentialImageSrc('data:image/svg+xml;base64,AAAA'),'');
assert.equal(api.credentialImageSrc('data:image/webp;base64,AAAA'),'data:image/webp;base64,AAAA');
assert.equal(api.credentialImageSrc('https://example.com/ticket.jpg'),'https://example.com/ticket.jpg');
state.isReadOnly.value=true;api.openCredentialPreview(state.vaultEntries.value[0]);assert.equal(state.credentialPreview.value.id,'h');
api.zoomCredentialPreview(1);assert.equal(state.credentialPreviewFit.value,false);for(let i=0;i<20;i++)api.zoomCredentialPreview(1);assert.equal(state.credentialPreviewZoom.value,4);for(let i=0;i<20;i++)api.zoomCredentialPreview(-1);assert.equal(state.credentialPreviewZoom.value,1);
api.fitCredentialPreview();assert.equal(state.credentialPreviewFit.value,true);api.closeCredentialPreview();assert.equal(state.credentialPreview.value,null);
state.vaultUnlocked.value=false;api.openCredentialPreview(state.vaultEntries.value[0]);assert.equal(state.credentialPreview.value,null);
assert(!html.includes(':href="entry.image"'));assert(html.includes('aria-modal="true" aria-labelledby="vault-preview-title"'));
console.log('PASS credential filtering/date groups/search, safe image URLs, in-page preview/zoom, locked browsing, closed vault protection. No production data used.');
