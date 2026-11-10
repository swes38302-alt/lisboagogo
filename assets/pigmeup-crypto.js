/* Private inbox crypto. No trip access, no Telegram Token, no cloud writes. */
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
  const key=await crypto.subtle.importKey('raw',keyBytes(secret),'AES-GCM',false,['decrypt']);
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
 function url(ctx,suffix){if(!/^(index|media\/[a-f0-9]{64})$/.test(suffix))throw new Error('路徑不符');return BASE+ctx.id+'/'+suffix+'.json';}
 async function read(ctx,suffix){
  const r=await fetch(url(ctx,suffix),{cache:'no-store',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw new Error('同步空間暫時無法讀取');
  const reader=r.body.getReader();let length=0;const chunks=[];
  while(true){const result=await reader.read();if(result.done)break;length+=result.value.length;if(length>12000000){await reader.cancel();throw new Error('同步內容過大');}chunks.push(result.value);}
  const bytes=new Uint8Array(length);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
  const envelope=JSON.parse(dec.decode(bytes));if(envelope===null)return null;return decrypt(ctx,envelope);
 }
 function safeURL(value){try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)?u.href:'';}catch{return '';}}
 const api={context,decrypt,url,read,safeURL,decode:bytes=>dec.decode(bytes)};
 root.PigInboxCrypto=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
