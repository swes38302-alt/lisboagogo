/* Saved-place mapping only. No bulk geocoding, private raw text is never queried. */
(function(root){
 'use strict';
 const CONFIG={tiles:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',photon:'https://photon.komoot.io/api/'};
 const valid=p=>!!p&&p.lat!==''&&p.lon!==''&&p.lat!=null&&p.lon!=null&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon))&&Math.abs(Number(p.lat))<=85&&Math.abs(Number(p.lon))<=180;
 const queryKey=card=>String(card.address||card.mapQuery||card.title||'').trim().toLocaleLowerCase();
 function explicit(card){
  const raw=card.raw||'';const match=raw.match(/(?:座標|坐标|coordinates?)\s*[:：]\s*(-?\d+(?:\.\d+)?)\s*[,，]\s*(-?\d+(?:\.\d+)?)/i);
  if(match){const p={lat:Number(match[1]),lon:Number(match[2]),source:'分享內的座標'};if(valid(p))return p;}
  for(const link of card.urls||[]){try{
   const u=new URL(link);let p;
   if(/^(?:www\.|maps\.)?google\.(?:com|com\.tw|co\.jp|co\.kr|it|fr|de|co\.uk)$/.test(u.hostname)){
    const q=u.searchParams.get('query')||u.searchParams.get('q')||'';
    const m=q.match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/)||u.pathname.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
    if(m)p={lat:Number(m[1]),lon:Number(m[2]),source:'分享地圖的座標'};
   }else if(u.protocol==='nmap:'&&u.hostname==='place'&&u.searchParams.has('lat')&&u.searchParams.has('lng'))p={lat:Number(u.searchParams.get('lat')),lon:Number(u.searchParams.get('lng')),source:'分享地圖的座標'};
   if(valid(p))return p;
  }catch{}}
  return null; // @lat,lon and ll parameters are viewport centres, NOT place coordinates.
 }
 function point(card,placements){const saved=placements[card.id];if(saved&&saved.query===queryKey(card)&&valid(saved))return saved;return explicit(card);}
 function region(cards){
  const text=cards.map(c=>c.location||'').join(' '),ids=[...new Set(cards.map(c=>c.countryId).filter(Boolean))];
  if(ids.length!==1)return {lat:25,lon:25,zoom:2,label:'收藏地區總覽，未定位的收藏不會偽裝成店家標記'};
  if(ids[0]==='KOR'&&/濟州|济州|제주/.test(text))return {lat:33.38,lon:126.55,zoom:9,label:'濟州島區域總覽・不是店家位置'};
  if(ids[0]==='ITA'&&/羅馬|梵蒂岡/.test(text))return {lat:41.902,lon:12.485,zoom:12,label:'羅馬／梵蒂岡區域總覽・不是店家位置'};
  const centers={KOR:[36.4,127.7,6],ITA:[42.8,12.7,5],JPN:[36.2,138.3,5],TWN:[23.7,121,7],FRA:[46.5,2.5,5],GBR:[54,-2,5],THA:[15.5,101,5]};
  const c=centers[ids[0]]||[25,25,2];return {lat:c[0],lon:c[1],zoom:c[2],label:'國家／地區總覽・尚未定位的收藏不會釘在中心點'};
 }
 function candidates(data,card){
  const iso={KOR:'KR',ITA:'IT',JPN:'JP',TWN:'TW',FRA:'FR',GBR:'GB',THA:'TH'}[card.countryId];
  return (data.features||[]).filter(f=>f?.geometry?.type==='Point').map(f=>{
   const p=f.properties||{},coords=f.geometry.coordinates;
   return {lat:coords[1],lon:coords[0],name:p.name||p.street||'地址結果',address:[p.street,p.housenumber,p.city,p.state,p.country].filter(Boolean).join(' '),
    countrycode:p.countrycode,level:p.type||'',source:'Photon／OpenStreetMap・需自行確認'};
  }).filter(p=>valid(p)&&(!iso||p.countrycode===iso||(card.countryId==='ITA'&&p.countrycode==='VA'))).slice(0,5);
 }
 function references(card){
  if(card.countryId==='KOR'&&/할머니떡집|老奶奶.*年糕/.test(card.title||''))return [{lat:33.2512764,lon:126.5603458,name:'할머니떡집방앗간',address:'제주특별자치도 서귀포시 중앙로79번길 12',countrycode:'KR',source:'Visit Jeju 官方同名店家・地址與原收藏不同，需核對',sourceURL:'https://www.visitjeju.net/kr/detail/view?contentsid=CNTS_200000000012732'}];
  return [];
 }
 let queue=Promise.resolve(),lastRequest=0;const cache=new Map();
 function search(card,text,fetcher=root.fetch){
  const q=String(text||'').trim();if(!q||q.length>300)return Promise.reject(new Error('請提供清楚的店名或地址'));
  const key=card.countryId+'|'+q;if(cache.has(key))return Promise.resolve(cache.get(key));
  const task=async()=>{
   const wait=Math.max(0,1200-(Date.now()-lastRequest));if(wait)await new Promise(r=>setTimeout(r,wait));lastRequest=Date.now();
   const u=new URL(CONFIG.photon);u.searchParams.set('q',q);u.searchParams.set('limit','5');
   const iso={KOR:'KR',ITA:'IT',JPN:'JP',TWN:'TW',FRA:'FR',GBR:'GB',THA:'TH'}[card.countryId];if(iso){u.searchParams.append('countrycode',iso);if(card.countryId==='ITA')u.searchParams.append('countrycode','VA');}
   const r=await fetcher(u.href,{referrerPolicy:'origin',signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error('查詢服務暫時無法使用，仍可手動釘選');
   const found=candidates(await r.json(),card);cache.set(key,found);return found;
  };
  const result=queue.then(task,task);queue=result.catch(()=>{});return result;
 }
 const api={CONFIG,valid,queryKey,explicit,point,region,candidates,references,search};root.IdeaMapModel=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
