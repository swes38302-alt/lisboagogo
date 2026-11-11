(function(root){
 'use strict';
 const GROUPS=[{name:'美食',emoji:'🍽️',subtypes:['餐廳','小吃','甜點','咖啡']},{name:'景點',emoji:'📍',subtypes:['市場','自然','文化','樂園']},{name:'住宿',emoji:'🏡',subtypes:['飯店','韓屋','獨棟']},{name:'購物',emoji:'🛍️',subtypes:['伴手禮','選物']},{name:'交通',emoji:'🚗',subtypes:['租車','搭船','大眾交通']},{name:'準備與撇步',emoji:'🗓️',subtypes:['購票','實用資訊','影片索引']}];
 const text=v=>typeof v==='string'?v:'';
 function cityFor(card){
  if(card.scope==='country')return '';
  const city=text(card.city||card.original?.classification?.city),place=[city,card.location,card.address].filter(Boolean).join(' ');
  if(/濟州|济州|제주/.test(place))return '濟州島';
  if(/釜山|부산/.test(place))return '釜山';
  if(/首爾|首尔|서울/.test(place))return '首爾';
  if(/大阪|Osaka/i.test(place))return '大阪';if(/東京|Tokyo/i.test(place))return '東京';
  if(/羅馬|罗马|Roma|Rome|梵蒂岡/.test(place))return '羅馬／梵蒂岡';
  if(city&&city!=='待分類')return city.split(/[・·|｜]/)[0].trim();
  const value=text(card.location).split(/[・·]/).map(s=>s.trim()).filter(s=>s&&!/^(韓國|韓国|韩国|日本|義大利|意大利|臺灣|台灣|地點待分類)$/.test(s));
  return value[0]||'';
 }
 function tagsFor(card){
  const tags=[],add=(group,subtype)=>{const value=group+'／'+subtype;if(!tags.includes(value))tags.push(value);};
  for(const label of card.tags||[]){const [group,sub]=text(label).split('／');if(GROUPS.some(g=>g.name===group&&g.subtypes.includes(sub)))add(group,sub);}
  if(tags.length)return tags;
  const t=[card.title,card.subtag].join(' '),k=card.category;
  if(k==='咖啡')add('美食','咖啡');
  else if(k==='美食'){
   if(/小吃|糖餅|年糕|麻糬/.test(t))add('美食','小吃');if(/甜點|糖餅|年糕|麻糬/.test(t))add('美食','甜點');
   if(!tags.length)add('美食',/市場/.test(t)?'小吃':'餐廳');
  }else if(k==='景點')add('景點',/市場|시장/.test(t)?'市場':/樂園|影城|迪士尼/.test(t)?'樂園':/神社|寺|博物館|競技場/.test(t)?'文化':'自然');
  else if(k==='住宿')add('住宿',/韓屋/.test(t)?'韓屋':/獨棟/.test(t)?'獨棟':'飯店');
  else if(k==='購物')add('購物',/伴手禮/.test(t)?'伴手禮':'選物');
  else if(k==='交通')add('交通',/租車/.test(t)?'租車':/船|牛島/.test(t)?'搭船':'大眾交通');
  else add('準備與撇步',k==='準備提醒'?'購票':/影片|索引/.test(t)?'影片索引':'實用資訊');
  if(/市場|시장/.test(card.title||''))add('景點','市場');
  return tags;
 }
 function present(card){
  const city=cityFor(card),isGeneric=!city&&!card.address&&!card.mapQuery;
  return {...card,city,tags:tagsFor(card),scope:card.scope==='country'||isGeneric?'country':city?'city':'place',
   experiences:Array.isArray(card.experiences)?card.experiences.filter(r=>r&&typeof r==='object'):[]};
 }
 function scopes(cards){
  const list=[];if(cards.some(c=>c.scope==='country'))list.push({id:'@country',name:'全國靈感與心願',emoji:'✨',count:cards.filter(c=>c.scope==='country').length});
  for(const city of [...new Set(cards.filter(c=>c.scope==='city').map(c=>c.city))].sort((a,b)=>a.localeCompare(b,'zh-Hant')))list.push({id:city,name:city,emoji:'📍',count:cards.filter(c=>c.city===city&&c.scope==='city').length});
  if(cards.some(c=>c.scope==='place'))list.push({id:'@places',name:'地點收藏',emoji:'📌',count:cards.filter(c=>c.scope==='place').length});return list;
 }
 const inScope=(card,scope)=>scope==='@country'?card.scope==='country':scope==='@places'?card.scope==='place':card.scope==='city'&&card.city===scope;
 function filter(cards,{country='',scope='',group='',subtype='',search=''}={}){
  const q=search.trim().toLocaleLowerCase();return cards.filter(c=>(!country||c.countryId===country)&&(!scope||inScope(c,scope))&&(!group||c.tags.some(t=>t.startsWith(group+'／')&&(!subtype||t===group+'／'+subtype)))&&(!q||[c.title,c.summary,c.address,c.raw,c.city,...c.tags,...c.experiences.map(r=>[r.place,r.city,r.review].join(' '))].join(' ').toLocaleLowerCase().includes(q))).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
 }
 const api={GROUPS,cityFor,tagsFor,present,scopes,inScope,filter};root.IdeaLibraryModel=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
