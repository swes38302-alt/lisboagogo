(function(root){
 'use strict';
 const {ref,computed,watch,onMounted,onUnmounted,nextTick}=Vue,G=IdeaMapModel;
 root.IdeaPlaceMap={props:{cards:Array,controller:Object,selectedId:String},emits:['select'],setup(props,{emit}){
  const element=ref(null),error=ref(''),locating=ref(false),finding=ref(false),saving=ref(false),query=ref(''),results=ref([]),draftLat=ref(''),draftLon=ref(''),note=ref(''),editingId=ref(''),reference=ref(null);
  let map,markers,preview,resize,expected=null,editQuery='',manualClick=false;const markerRefs=new Map();
  const selected=computed(()=>props.cards.find(c=>c.id===props.selectedId)||props.cards[0]||null);
  const getPoint=card=>G.point(card,props.controller.placements.value);
  const placedCount=computed(()=>props.cards.filter(getPoint).length);
  const draftValid=computed(()=>G.valid({lat:draftLat.value,lon:draftLon.value}));
  const overview=computed(()=>G.region(props.cards));
  function select(card){emit('select',card.id);const point=getPoint(card);if(point&&map)map.setView([point.lat,point.lon],Math.max(15,map.getZoom()),{animate:false});}
  function fit(){if(!map)return;const points=props.cards.map(getPoint).filter(Boolean);if(points.length)map.fitBounds(points.map(p=>[p.lat,p.lon]),{padding:[35,35],maxZoom:16,animate:false});else{const r=overview.value;map.setView([r.lat,r.lon],r.zoom,{animate:false});}}
  function draw(){if(!map||!markers)return;for(const marker of markerRefs.values())marker.closeTooltip();markerRefs.clear();markers.clearLayers();props.cards.forEach((card,index)=>{const p=getPoint(card);if(!p)return;
   const color=({'美食':'#b76c36','咖啡':'#816049','購物':'#74608e','住宿':'#426f97','準備提醒':'#9b803d'})[card.category]||'#226a5a';
   const icon=L.divIcon({className:'saved-place-icon',html:'<span style="background:'+color+'">'+String(index+1)+'</span>',iconSize:[34,40],iconAnchor:[17,37]});
   const marker=L.marker([p.lat,p.lon],{icon,keyboard:true,title:card.title,alt:card.title,zIndexOffset:card.id===selected.value?.id?500:0}).addTo(markers);
   markerRefs.set(card.id,marker);
   const tooltip=document.createElement('span');tooltip.textContent=card.emoji+' '+card.title;marker.bindTooltip(tooltip,{direction:'top'});marker.on('click',()=>select(card));
  });}
  function showDraft(){if(!map)return;if(preview){map.removeLayer(preview);preview=null;}if(!draftValid.value)return;preview=L.circleMarker([Number(draftLat.value),Number(draftLon.value)],{radius:10,color:'#b77523',fillColor:'#f3cc77',fillOpacity:.8,dashArray:'4 3'}).addTo(map);}
  async function begin(){if(!selected.value)return;editingId.value=selected.value.id;locating.value=true;reference.value=null;results.value=G.references(selected.value);note.value=results.value.length?'已附官方同名店家參考，地址與原收藏不同，請先核對是否同一間。':'搜尋候選需核對店名與地址；也可以按「手動釘選」後點地圖。';query.value=selected.value.address||selected.value.mapQuery||'';
   editQuery=G.queryKey(selected.value);expected=props.controller.placements.value[selected.value.id]||null;const p=getPoint(selected.value);draftLat.value=p?.lat??'';draftLon.value=p?.lon??'';manualClick=false;showDraft();
  }
  async function find(){const card=selected.value;if(!card||finding.value)return;finding.value=true;results.value=[];note.value='查詢中…';const id=card.id;
   try{const found=await G.search(card,query.value);if(selected.value?.id!==id||!locating.value)return;results.value=[...G.references(card),...found];note.value=results.value.length?'這些是候選位置，不代表同名店家。請對照地址後再儲存。':'找不到可靠結果，請改用明確店名，或手動釘選／填入座標。';}catch(e){note.value=e.message;}finally{finding.value=false;}}
  function choose(p){reference.value=p;draftLat.value=p.lat;draftLon.value=p.lon;note.value='候選：'+p.name+'。'+p.source+'。確認後才會儲存。';showDraft();if(map)map.setView([p.lat,p.lon],17,{animate:false});}
  function manual(){manualClick=true;reference.value=null;note.value='請在地圖上點一下要標記的位置，再按「儲存位置」。';element.value?.scrollIntoView({block:'center',behavior:'smooth'});}
  function cancel(){locating.value=false;manualClick=false;results.value=[];editingId.value='';if(preview&&map){map.removeLayer(preview);preview=null;}}
  async function save(){const card=selected.value;if(!card||saving.value||!draftValid.value)return;if(card.id!==editingId.value||G.queryKey(card)!==editQuery){note.value='收藏內容已更新，請重新開始定位。';return;}
   saving.value=true;try{await props.controller.savePlacement(card,{lat:Number(draftLat.value),lon:Number(draftLon.value),query:editQuery,source:'使用者釘選／確認',referenceName:reference.value?.name||'',referenceURL:reference.value?.sourceURL||'',referenceAddress:reference.value?.address||'',confirmedAt:new Date().toISOString()},expected);cancel();draw();select(card);}catch(e){note.value=e.message;}finally{saving.value=false;}}
  watch(()=>props.cards.map(c=>c.id+'|'+c.title+'|'+G.queryKey(c)).join('\n'),()=>{cancel();nextTick(()=>{draw();fit();});});
  watch(()=>JSON.stringify(props.controller.placements.value),()=>draw());
  watch(()=>props.selectedId,()=>{if(locating.value)cancel();for(const [id,marker] of markerRefs)marker.setZIndexOffset(id===selected.value?.id?500:0);});
  watch([draftLat,draftLon],showDraft);
  onMounted(async()=>{await nextTick();if(!root.L){error.value='地圖套件暫時無法載入，收藏仍可用清單查看。';return;}
   map=L.map(element.value,{zoomControl:true,scrollWheelZoom:false,attributionControl:true});
   L.tileLayer(G.CONFIG.tiles,{maxZoom:19,referrerPolicy:'origin',attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'}).addTo(map).on('tileerror',()=>{error.value='底圖暫時讀取失敗，收藏與已保存的位置不會消失。';});
   markers=L.layerGroup().addTo(map);map.on('click',e=>{if(!manualClick||!locating.value)return;draftLat.value=Number(e.latlng.lat.toFixed(6));draftLon.value=Number(e.latlng.lng.toFixed(6));manualClick=false;note.value='位置已選取，請確認後儲存。';showDraft();});draw();fit();
   resize=new ResizeObserver(()=>map?.invalidateSize({pan:false}));resize.observe(element.value);
  });
  onUnmounted(()=>{resize?.disconnect();if(map){map.remove();map=null;}});
  return {element,error,locating,finding,saving,query,results,draftLat,draftLon,note,selected,draftValid,placedCount,overview,getPoint,select,fit,begin,find,choose,manual,cancel,save};
 },template:`<section class="saved-place-panel" aria-label="收藏店家地圖"><div class="saved-place-toolbar"><span>📍 {{placedCount}} 個已定位 · {{cards.length-placedCount}} 個待定位</span><button class="text-button" @click="fit">顯示全部位置</button></div><div class="saved-place-layout"><div class="saved-place-map-wrap"><div ref="element" class="saved-place-map" aria-label="可縮放的收藏位置地圖"></div><p v-if="!placedCount" class="saved-place-overview">{{overview.label}}</p><p v-if="error" class="saved-place-error" role="status">{{error}}</p></div><aside class="saved-place-list"><button v-for="(card,index) in cards" :key="card.id" :class="['saved-place-row',{active:selected?.id===card.id}]" @click="select(card)"><span class="saved-place-number">{{index+1}}</span><span><strong>{{card.emoji}} {{card.title}}</strong><small>{{getPoint(card)?'已定位':'待定位'}} · {{card.location}}</small></span></button></aside></div>
 <div v-if="selected" class="saved-place-selected"><div><strong>{{selected.title}}</strong><small>{{getPoint(selected)?'點地圖標記或右方清單，可切換收藏內容':'這個收藏尚未定位，不會釘在地區中心點'}}</small><small v-if="getPoint(selected)?.referenceAddress">釘選參考：{{getPoint(selected).referenceName}} · {{getPoint(selected).referenceAddress}}</small></div><button class="quiet" @click="begin">{{getPoint(selected)?'調整位置':'找位置／釘選'}}</button></div>
 <div v-if="locating" class="saved-place-editor"><div class="saved-place-editor-head"><strong>定位：{{selected.title}}</strong><button class="text-button" @click="cancel">取消</button></div><form @submit.prevent="find"><label>店名／地址<input v-model.trim="query" maxlength="300" placeholder="只查這個收藏的店名／地址"></label><button class="quiet" :disabled="finding">{{finding?'查詢中…':'查詢候選位置'}}</button></form><p class="saved-place-help">{{note}}</p><div class="saved-place-candidates"><button v-for="(p,index) in results" :key="index" @click="choose(p)"><strong>{{p.name}}</strong><small>{{p.address}}</small><small>{{p.source}}</small></button></div><p v-if="results.some(p=>p.sourceURL)" class="saved-place-help"><a v-for="p in results.filter(p=>p.sourceURL)" :key="p.sourceURL" :href="p.sourceURL" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">查看官方同名店家資料 ↗</a></p><div class="saved-place-coordinate"><button class="quiet" @click="manual">📌 手動釘選</button><label>緯度<input v-model="draftLat" type="number" step="any" min="-85" max="85" placeholder="例如 33.25"></label><label>經度<input v-model="draftLon" type="number" step="any" min="-180" max="180" placeholder="例如 126.56"></label><button class="primary" :disabled="!draftValid||saving" @click="save">{{saving?'儲存中…':'儲存位置'}}</button></div><small>按查詢才將店名／地址送給 Photon，不送群組筆記。位置需自行確認；私人收藏的釘選會加密同步。</small></div></section>`};
})(globalThis);
