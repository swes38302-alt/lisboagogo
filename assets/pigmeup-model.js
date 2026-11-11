/* Read-only presentation projections. Never writes trips or shared plans. */
(function(root){
 'use strict';
 const KINDS=['景點','美食','咖啡','購物','住宿','交通','撇步','準備提醒','待分類'];
 const ICONS={'景點':'📍','美食':'🍽️','咖啡':'☕','購物':'🛍️','住宿':'🏡','交通':'🚗','撇步':'💡','準備提醒':'🗓️','待分類':'📥','旅行想法':'🧭','節慶活動':'🎉'};
 const FOOD=/年糕|麻糬|糯米|小吃|甜點|甜点|떡집|떡볶이|餅店|饼店|烘焙|麵包|面包|冰淇淋/i;
 function countryId(name,world){
  // Vatican has no polygon in the coarse map: group only its marker in the Italy travel region.
  const aliases={'梵蒂岡':'ITA','梵蒂冈':'ITA','台灣':'TWN','臺灣':'TWN','義大利':'ITA','意大利':'ITA','韓國':'KOR','韩国':'KOR','日本':'JPN','法國':'FRA','英國':'GBR','泰國':'THA'};
  return aliases[name]||world?.countries.find(c=>c.id===name||c.name===name)?.id||'';
 }
 const clean=value=>String(value||'').replace(/^[\s📍📌▪•🔸\-]+/u,'').trim();
 function dateHint(raw){
  const full=raw.match(/\b(20\d{2})\s*(?:年|[/.\-])\s*(\d{1,2})\s*月?(上旬|中旬|下旬|初|底)?/);
  if(full&&Number(full[2])>=1&&Number(full[2])<=12)return `${full[1]}/${full[2].padStart(2,'0')}${full[3]?' '+full[3]:''}`;
  const vague=raw.match(/(\d{1,2})\s*月\s*(上旬|中旬|下旬|初|底)?/);
  return vague?`${Number(vague[1])} 月${vague[2]||''} · 年份待確認`:'';
 }
 function view(item,world){
  const raw=String(item.raw||''),lines=raw.split(/\r?\n/).map(clean).filter(Boolean),c=item.classification||{};
  const category=(!c.category||c.category==='待分類')&&FOOD.test(raw)&&c.method!=='manual'?'美食':c.category||'待分類';
  const explicit=lines.find(s=>/^(?:店名|名稱|名称|景點|景点)\s*[:：]/.test(s));
  let title=explicit?explicit.replace(/^[^:：]+[:：]\s*/,''):lines.find(s=>!/^https?:\/\//i.test(s)&&!/^(?:地址|位置)\s*[:：]/.test(s))||'圖片／旅行想法';
  title=title.replace(/\s*\b20\d{2}\s*(?:年|[/.\-])\s*\d{1,2}\s*月?.*$/,'').trim()||title;
  if(title.length>90)title=title.slice(0,90)+'…';
  const addressLine=lines.find(s=>/^(?:地址|位置)\s*[:：]/.test(s));
  const address=addressLine?addressLine.replace(/^[^:：]+[:：]\s*/,''):'';
  const location=[...new Set([c.country,c.city].filter(s=>s&&s!=='待分類'))].join('・')||'地點待分類';
  const summary=lines.filter(s=>s!==explicit&&s!==addressLine&&!s.startsWith(title)&&!/^https?:\/\//i.test(s)).join(' ').slice(0,140);
  const namedPlace=!!explicit||(/博物館|競技場|竞技场|神社|公園|水族館|飯店|酒店|拉麵|年糕|咖啡|hotel|museum/i.test(title)&&title.length<65&&!/好想|這間|这间|這家|这家|先把|想去|推薦|推荐/.test(title));
  const subtag=category==='美食'&&/年糕|麻糬|떡집|떡볶이/.test(raw)?'小吃／甜點':category==='美食'&&/甜點|甜点|冰淇淋|烘焙|麵包|面包/.test(raw)?'甜點／烘焙':'';
  return {id:'tg-'+item.id,source:'telegram',original:item,title,summary,address,location,
   countryId:countryId(c.country,world),category,subtag,emoji:ICONS[category]||'🧭',
   dateHint:category==='準備提醒'?dateHint(raw):'',createdAt:item.createdAt,urls:item.urls||[],media:item.media||[],
   mapQuery:address||(namedPlace?title+' '+(c.city||c.country||''):''),
   needsReview:(!c.country||c.country==='待分類'||category==='待分類'),raw};
 }
 function manual(entry,event){
  return {id:'manual-'+entry.id,originalId:entry.id,source:'manual',title:event.name,summary:entry.note||'',
   location:event.location||'',address:'',countryId:entry.country||event.country||'',category:entry.kind||'旅行想法',subtag:'',
   emoji:ICONS[entry.kind]||event.emoji||'🧭',dateHint:'',createdAt:Number.isFinite(new Date(entry.createdAt||0).getTime())?new Date(entry.createdAt||0).toISOString():'',
   urls:entry.link?[entry.link]:[],media:[],mapQuery:[event.name,entry.location||event.location||''].filter(Boolean).join(' '),needsReview:false,raw:entry.note||'',stage:entry.stage};
 }
 function counts(cards,world){
  const result=new Map();for(const card of cards){const country=world.countries.find(c=>c.id===card.countryId);if(!country)continue;
   if(!result.has(country.id))result.set(country.id,{...country,count:0});result.get(country.id).count++;}return [...result.values()];
 }
 function views(items,world,organization){
  const base=items.map(i=>view(i,world)),byId=new Map(base.map(c=>[c.original.id,c])),used=new Set(),grouped=[];
  for(const g of organization?.groups||[]){
   if(!g||!Array.isArray(g.sources)||!g.sources.length||!KINDS.includes(g.category)||typeof g.title!=='string'||typeof g.summary!=='string')continue;
   const ids=g.sources.map(s=>s.id),members=ids.map(id=>byId.get(id));
   if(new Set(ids).size!==ids.length||members.some(c=>!c||used.has(c.original.id))||!ids.includes(g.anchorId))continue;
   const anchor=byId.get(g.anchorId),text=v=>typeof v==='string'?v:'',raw=members.map(c=>`${c.original.sender||'TG 分享'}\n${c.raw}`).join('\n\n───\n\n');
   grouped.push({...anchor,title:g.title,summary:g.summary,address:text(g.address),
    location:[...new Set([g.country,g.city].filter(Boolean))].join('・'),countryId:countryId(g.country,world),
    category:g.category,subtag:text(g.subtag),emoji:ICONS[g.category],mapQuery:text(g.mapQuery),
    needsReview:!!g.needsReview,dateHint:g.category==='準備提醒'?dateHint(raw):'',raw,
    urls:[...new Set(members.flatMap(c=>c.urls))],media:members.flatMap(c=>c.media),
    sourceCards:members,organized:true,sourceCount:members.length,
    cautions:Array.isArray(g.cautions)?g.cautions.filter(v=>typeof v==='string'):[],
    createdAt:members.map(c=>c.createdAt).sort().at(-1),organizedAt:g.organizedAt});
   ids.forEach(id=>used.add(id));
  }
  return [...base.filter(c=>!used.has(c.original.id)),...grouped];
 }
 const api={KINDS,ICONS,FOOD,countryId,dateHint,view,views,manual,counts};root.PigIdeaModel=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
