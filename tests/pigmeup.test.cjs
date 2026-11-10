const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const path=require('node:path');
const C=require('../assets/pigmeup-crypto.js');
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
 for(const file of ['pigmeup-crypto.js','pigmeup-inbox.js','explore.js'])new vm.Script(fs.readFileSync(path.join(__dirname,'../assets',file),'utf8'));
});
