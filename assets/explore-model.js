/* Pure long-term planning helpers. This module never reads or writes trips. */
(function(root){
 'use strict';
 const STORAGE_KEY='lisboagogo:travelIdeas:v1', CLOUD_PATH='travelIdeas/v1';
 const empty=()=>({version:1,entries:{}});
 const clone=value=>JSON.parse(JSON.stringify(value));
 const safeURL=value=>{try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}};
 const validDate=value=>{try{return /^\d{4}-\d{2}-\d{2}$/.test(value)&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;}catch{return false;}};
 const uid=()=>root.crypto?.randomUUID?.()||'idea-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
 function normalize(value){
  const out=empty();
  if(!value||value.version!==1||!value.entries||typeof value.entries!=='object'||Array.isArray(value.entries))return out;
  Object.entries(value.entries).slice(0,1000).forEach(([id,entry])=>{if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id)||!entry||typeof entry!=='object'||Array.isArray(entry))return;const object=v=>v&&typeof v==='object'&&!Array.isArray(v);out.entries[id]={...clone(entry),id,experiences:object(entry.experiences)?clone(entry.experiences):{},tasks:object(entry.tasks)?Object.fromEntries(Object.entries(entry.tasks).filter(([,t])=>object(t)&&typeof t.title==='string').map(([key,t])=>[key,{...clone(t),id:key}])):{}};});
  return out;
 }
 function createEntry(event){return {id:event.id,eventId:event.id,stage:'收藏',year:'',participants:2,experiences:{},tasks:{},note:'',createdAt:Date.now()};}
 function begin(entry,event){const result=clone(entry);if(result.stage==='收藏')result.stage='了解中';if(!Object.keys(result.tasks||{}).length)(event.tasks||[]).forEach((task,index)=>{result.tasks['seed-'+index]={...task,id:'seed-'+index,date:'',dateType:'建議復查',done:false};});return result;}
 function upcoming(event,now=new Date()){
  const months=event.months||[];if(!months.length)return null;
  const monthStart=new Date(now.getFullYear(),now.getMonth(),1);
  let year=now.getFullYear();
  let month=months.find(m=>m>=now.getMonth()+1);
  if(!month){year++;month=months[0];}
  let confirmed=false;
  if(event.date&&validDate(event.date)&&new Date((event.endDate||event.date)+'T23:59:59')>=now){year=Number(event.date.slice(0,4));month=Number(event.date.slice(5,7));confirmed=event.dateStatus==='官方已確認';}
  const distance=(year-monthStart.getFullYear())*12+month-1-monthStart.getMonth();
  return {year,month,confirmed,distance,recommend:distance<=Number(event.leadMonths||6),label:confirmed?`${event.date} ～ ${event.endDate||event.date}`:`${year} 年 ${months.join('／')} 月附近・探索參考`};
 }
 function calendar(entries){return Object.values(entries).flatMap(entry=>Object.values(entry.tasks||{}).filter(task=>task.date&&validDate(task.date)).map(task=>({...task,dateType:task.dateType==='官方期限'&&!safeURL(task.source)?'官方期限・待補來源':task.dateType,entryId:entry.id,entryName:entry.name||entry.eventId}))).sort((a,b)=>a.date.localeCompare(b.date)||a.title.localeCompare(b.title));}
 const api={STORAGE_KEY,CLOUD_PATH,empty,clone,safeURL,validDate,uid,normalize,createEntry,begin,upcoming,calendar};
 root.ExploreModel=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
