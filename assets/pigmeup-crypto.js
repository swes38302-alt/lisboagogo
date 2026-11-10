/* Private inbox crypto. Trip data and Telegram Tokens are never accessed. */
(function(root){
 'use strict';
 const BASE='https://lisboaaa-2c65b-default-rtdb.firebaseio.com/pigmeupPrivate/v1/';
 const enc=new TextEncoder(), dec=new TextDecoder();
 function keyBytes(secret){
  if(!/^[A-Za-z0-9_-]{43}$/.test(secret||''))throw new Error('私人連結格式不符');
  const value=Uint8Array.from(atob(secret.replace(/-/g,'+').replace(/_/g,'/')+'='),c=>c.charCodeAt(0));
  if(value.length!==32)throw new Error('私人連結格式不符');return value;
 }
 async function context(secret){
  const key=await crypto.subtle.importKey('raw',keyBytes(secret),'AES-GCM',false,['decrypt','encrypt']);
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode('PigMeUp/v1/'+secret)));
  return {key,id:Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('')};
 }
 async function decrypt(ctx,envelope){
  if(envelope?.version!==1||typeof envelope.iv!=='string'||typeof envelope.data!=='string'||envelope.data.length>12000000)throw new Error('同步資料格式不符');
  const iv=Uint8Array.from(atob(envelope.iv),c=>c.charCodeAt(0));
  if(iv.length!==12)throw new Error('同步資料格式不符');
  const data=Uint8Array.from(atob(envelope.data),c=>c.charCodeAt(0));
  return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:enc.encode('PigMeUp/private-inbox/v1')},ctx.key,data));
 }
 function url(ctx,suffix){if(!/^(index|media\/[a-f0-9]{64}|placements(?:\/[a-f0-9]{64})?)$/.test(suffix))throw new Error('路徑不符');return BASE+ctx.id+'/'+suffix+'.json';}
 async function readJSON(ctx,suffix,etag=false){
  const r=await fetch(url(ctx,suffix),{cache:'no-store',headers:etag?{'X-Firebase-ETag':'true'}:undefined,referrerPolicy:'no-referrer',signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw new Error('同步空間暫時無法讀取');
  const reader=r.body.getReader();let length=0;const chunks=[];
  while(true){const result=await reader.read();if(result.done)break;length+=result.value.length;if(length>12000000){await reader.cancel();throw new Error('同步內容過大');}chunks.push(result.value);}
  const bytes=new Uint8Array(length);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
  return {value:JSON.parse(dec.decode(bytes)),etag:r.headers.get('etag')};
 }
 async function read(ctx,suffix){const {value}=await readJSON(ctx,suffix);return value===null?null:decrypt(ctx,value);}
 async function encrypt(ctx,value){const iv=crypto.getRandomValues(new Uint8Array(12)),data=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode('PigMeUp/private-inbox/v1')},ctx.key,enc.encode(JSON.stringify(value))));
  const b64=bytes=>{let s='';for(let at=0;at<bytes.length;at+=8192)s+=String.fromCharCode(...bytes.subarray(at,at+8192));return btoa(s);};return {version:1,iv:b64(iv),data:b64(data)};}
 const validPoint=p=>p&&p.version===1&&/^(?:tg|manual)-[A-Za-z0-9_-]{1,150}$/.test(p.id||'')&&typeof p.query==='string'&&p.query.length<2000&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Math.abs(p.lat)<=85&&Math.abs(p.lon)<=180;
 async function readPlacements(ctx){const {value}=await readJSON(ctx,'placements');const out={};for(const [,envelope] of Object.entries(value||{}).slice(0,1000)){try{const p=JSON.parse(dec.decode(await decrypt(ctx,envelope)));if(validPoint(p))out[p.id]=p;}catch{}}return out;}
 async function writePlacement(ctx,id,point,expected){
  const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode('placement/'+id))),suffix='placements/'+Array.from(hash,b=>b.toString(16).padStart(2,'0')).join('');
  const before=await readJSON(ctx,suffix,true),current=before.value?JSON.parse(dec.decode(await decrypt(ctx,before.value))):null;
  if((current?.updatedAt||'')!==(expected?.updatedAt||''))throw new Error('這個位置已被另一台裝置更新，請重新載入後再定位。');
  if(!before.etag)throw new Error('無法取得安全儲存版本，原位置未變更。');
  const value={...point,id,version:1,updatedAt:new Date().toISOString()};if(!validPoint(value))throw new Error('座標格式不符');
  const r=await fetch(url(ctx,suffix),{method:'PUT',headers:{'content-type':'application/json','if-match':before.etag},body:JSON.stringify(await encrypt(ctx,value)),referrerPolicy:'no-referrer',signal:AbortSignal.timeout(15000)});
  if(r.status===412)throw new Error('位置剛被其他裝置更新，已保留對方修改，請重新載入。');if(!r.ok)throw new Error('位置儲存失敗，原位置未變更。');return value;
 }
 function safeURL(value){try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)?u.href:'';}catch{return '';}}
 const api={context,decrypt,encrypt,url,read,readPlacements,writePlacement,safeURL,decode:bytes=>dec.decode(bytes)};
 root.PigInboxCrypto=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
