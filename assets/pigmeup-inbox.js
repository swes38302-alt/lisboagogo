(function(root){
 'use strict';
 const {ref,computed,watch,onMounted,onUnmounted}=Vue,C=PigInboxCrypto,M=PigIdeaModel;
 function use(){
  const secret=ref(''),connected=ref(false),busy=ref(false),message=ref('未連接 TG'),items=ref([]),lastUpdate=ref(''),imageURLs=ref({}),imageBusy=ref({}),remembered=ref(false),placements=ref({});
  let manualPlaces={};try{manualPlaces=JSON.parse(localStorage.getItem('lisboagogo:manual-idea-places:v1')||'{}');}catch{}placements.value={...manualPlaces};
  let ctx=null,timer=null,generation=0;
  function clearImages(){Object.values(imageURLs.value).forEach(u=>URL.revokeObjectURL(u));imageURLs.value={};}
  async function refresh(){
   if(!ctx||busy.value)return;busy.value=true;const ticket=generation,current=ctx;
   try{const bytes=await C.read(current,'index');if(ticket!==generation)return;
    if(!bytes){message.value='已連接，等待電腦同步';return;}
    const data=JSON.parse(C.decode(bytes));if(data.version!==1||!Array.isArray(data.items))throw new Error('format');
    items.value=data.items.filter(i=>i&&typeof i.id==='string'&&typeof i.raw==='string');
    const placed=await C.readPlacements(current);if(ticket!==generation)return;const nextPlaces={...manualPlaces,...placed};if(JSON.stringify(placements.value)!==JSON.stringify(nextPlaces))placements.value=nextPlaces;
    lastUpdate.value=new Date().toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'});message.value='TG 已同步';
   }catch{if(ticket===generation)message.value='TG 暫時離線，已載入內容保留';}finally{if(ticket===generation)busy.value=false;}
  }
  async function connect(){
   if(busy.value)return;busy.value=true;
   try{const next=await C.context(secret.value.trim());generation++;clearImages();ctx=next;connected.value=true;message.value='正在解密…';
    try{sessionStorage.setItem('pigmeup:private-key',secret.value.trim());}catch{}
    busy.value=false;await refresh();clearInterval(timer);timer=setInterval(()=>{if(!document.hidden)refresh();},30000);
   }catch{message.value='請使用小豬選單提供的完整私人連結';busy.value=false;}
  }
  function disconnect(){generation++;ctx=null;clearInterval(timer);clearImages();connected.value=false;busy.value=false;items.value=[];placements.value={...manualPlaces};secret.value='';remembered.value=false;message.value='未連接 TG';try{sessionStorage.removeItem('pigmeup:private-key');localStorage.removeItem('pigmeup:private-key');}catch{}}
  async function savePlacement(card,point,expected){
   let value;const ticket=generation;
   if(ctx)value=await C.writePlacement(ctx,card.id,point,expected);
   else{if(card.source!=='manual')throw new Error('請先連接私人收藏，位置不會明文上傳。');value={...point,id:card.id,version:1,updatedAt:new Date().toISOString()};const next={...manualPlaces,[card.id]:value};localStorage.setItem('lisboagogo:manual-idea-places:v1',JSON.stringify(next));manualPlaces=next;}
   if(ticket!==generation)throw new Error('連線已切換，請重新開啟原私人收藏確認位置。');placements.value={...placements.value,[card.id]:value};return value;
  }
  function remember(){try{localStorage.setItem('pigmeup:private-key',secret.value.trim());remembered.value=true;message.value='此裝置已記住連線';}catch{message.value='瀏覽器不允許儲存，請保管私人連結';}}
  async function showImage(media){
   if(!ctx||!media.available||!/^[a-f0-9]{64}$/.test(media.id)||imageURLs.value[media.id])return;
   const ticket=generation,current=ctx;imageBusy.value={...imageBusy.value,[media.id]:true};
   try{const bytes=await C.read(current,'media/'+media.id);if(ticket!==generation||!bytes)return;imageURLs.value={...imageURLs.value,[media.id]:URL.createObjectURL(new Blob([bytes],{type:'image/jpeg'}))};}
   catch{message.value='圖片暫時無法載入，原始附件仍在接收電腦';}finally{imageBusy.value={...imageBusy.value,[media.id]:false};}
  }
  function exportPrivate(){const a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify({app:'PigMeUp-private-inbox',version:1,items:items.value,placements:placements.value},null,2)],{type:'application/json'}));a.href=u;a.download='PigMeUp-私人靈感備份.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
  function loadLink(){const key=new URLSearchParams(location.hash.slice(1)).get('pig');if(!key)return;if(connected.value)disconnect();secret.value=key;connect();history.replaceState(null,'',location.pathname+location.search+'#saved');}
  onMounted(()=>{window.addEventListener('hashchange',loadLink);if(location.hash.startsWith('#pig=')){loadLink();return;}let key='';try{key=localStorage.getItem('pigmeup:private-key')||sessionStorage.getItem('pigmeup:private-key')||'';remembered.value=!!localStorage.getItem('pigmeup:private-key');}catch{}if(key){secret.value=key;connect();}});
  onUnmounted(()=>{window.removeEventListener('hashchange',loadLink);generation++;clearInterval(timer);clearImages();});
  return {secret,connected,busy,message,items,lastUpdate,imageURLs,imageBusy,remembered,placements,savePlacement,connect,refresh,disconnect,remember,showImage,exportPrivate};
 }
 root.PigInbox={use,
  props:{controller:Object,view:String,countryId:String,cards:Array,world:Object},emits:['country','open-manual','remove-manual','explore'],
  setup(props){
   const kind=ref(''),search=ref(''),settings=ref(false),i=props.controller,displayMode=ref('map'),selectedId=ref('');
   let mapNavigation;
   onMounted(()=>{mapNavigation=TripMapLinks.createNavigation({window,document,navigator});document.addEventListener('click',mapNavigation.handleClick);});
   onUnmounted(()=>{if(mapNavigation){document.removeEventListener('click',mapNavigation.handleClick);mapNavigation.dispose();}});
   watch(()=>props.countryId,()=>{kind.value='';search.value='';});
   watch(()=>props.view,(next,previous)=>{if(next==='saved'&&previous==='explore'){kind.value='';search.value='';}});
   const filtered=computed(()=>props.cards.filter(c=>(!props.countryId||c.countryId===props.countryId)&&(!kind.value||c.category===kind.value)&&(!search.value||[c.title,c.summary,c.location,c.raw,...c.urls].join(' ').toLowerCase().includes(search.value.toLowerCase()))).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))));
   const countries=computed(()=>M.counts(props.cards,props.world).sort((a,b)=>a.name.localeCompare(b.name,'zh-Hant')));
   const kinds=computed(()=>[...new Set(props.cards.map(c=>c.category))]);
   const visibleCards=computed(()=>displayMode.value==='list'?filtered.value:filtered.value.length?[filtered.value.find(c=>c.id===selectedId.value)||filtered.value[0]]:[]);
   const date=value=>{const d=new Date(value);return Number.isFinite(d.getTime())?`${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`:'';};
   const map=card=>TripMapLinks.build({location:card.mapQuery},{mapProvider:card.countryId==='KOR'?'naver':'google'});
   return {...i,kind,search,settings,filtered,visibleCards,displayMode,selectedId,countries,kinds,date,map,safeURL:C.safeURL};
  },
  template:`<section v-show="view==='explore'||view==='saved'" class="idea-collection" aria-label="整合旅行收藏">
   <div class="idea-connection"><span><i :class="['status-dot',{online:connected}]"></i>{{message}}<small v-if="connected"> · {{items.length}} 則私人想法</small></span><button class="text-button" @click="settings=!settings">{{settings?'收起設定':connected?'連線設定':'連接 TG'}}</button></div>
   <div v-if="settings" class="idea-settings"><p>同一份收藏，多一個 TG 輸入入口。私人內容只在解密後顯示，不會改動正式旅程。</p><form v-if="!connected" @submit.prevent="connect"><label>私人鑰匙<input type="password" v-model.trim="secret" autocomplete="off" placeholder="從電腦小豬選單的私人連結開啟即可自動帶入"></label><button class="primary" :disabled="busy">連接</button></form><div v-else class="idea-settings-actions"><button class="quiet" @click="refresh" :disabled="busy">更新 TG</button><button class="quiet" @click="remember" :disabled="remembered">{{remembered?'此裝置已記住 ✓':'記住此裝置'}}</button><button class="text-button" @click="exportPrivate">下載私人備份</button><button class="text-button muted" @click="disconnect">斷開連線</button></div><small>私人連結只給同行的人；共用電腦不要記住。{{lastUpdate?'上次更新 '+lastUpdate:''}}</small></div>
   <template v-if="view==='saved'"><div class="idea-heading"><div><h2>想去的，都收在一起。</h2><p>網站收藏或丟進 TG 都可以。選國家，再慢慢挑想吃、想逛的地方。</p></div><button class="quiet" @click="$emit('explore')">🗺️ 用地圖找</button></div>
   <div class="idea-filters"><label>國家<select :value="countryId" @change="$emit('country',$event.target.value)"><option value="">全部國家</option><option v-for="c in countries" :value="c.id" :key="c.id">{{c.name}} · {{c.count}}</option><option v-if="countryId&&!countries.some(c=>c.id===countryId)" :value="countryId">{{world.countries.find(c=>c.id===countryId)?.name||countryId}}</option></select></label><label>分類<select v-model="kind"><option value="">全部分類</option><option v-for="k in kinds" :key="k">{{k}}</option></select></label><label class="idea-search">搜尋<input type="search" v-model="search" placeholder="店名、城市、想法…"></label></div>
<div v-if="filtered.length" class="idea-view-switch" role="group" aria-label="收藏顯示方式"><button :class="{active:displayMode==='map'}" @click="displayMode='map'">🗺️ 地圖</button><button :class="{active:displayMode==='list'}" @click="displayMode='list'">☷ 清單</button><small>{{filtered.length}} 則收藏</small></div><idea-place-map v-if="displayMode==='map'&&filtered.length" :cards="filtered" :controller="controller" :selected-id="selectedId" @select="selectedId=$event"></idea-place-map>   <div class="idea-grid"><article v-for="card in visibleCards" :key="card.id" class="idea-card"><div class="idea-card-meta"><span>{{card.emoji}} {{card.category}}<small v-if="card.subtag"> · {{card.subtag}}</small></span><small v-if="card.source==='telegram'" title="私人 TG 收藏">TG 🔒</small><small v-else>網站收藏</small></div><h3>{{card.title}}</h3><p class="idea-location">{{card.location}}</p><p v-if="card.dateHint" class="idea-date-hint">🗓️ {{card.dateHint}} <small>購票準備筆記</small></p><p v-if="card.summary&&card.category!=='準備提醒'" class="idea-summary">{{card.summary}}</p><p v-if="card.address" class="idea-address">{{card.address}}</p>
   <div class="idea-card-actions"><a v-if="card.mapQuery" :href="map(card).href" :data-naver-app="map(card).appUrl||undefined" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">📍 {{card.countryId==='KOR'?'NAVER 地圖':'查看地圖'}} ↗</a><a v-if="safeURL(card.urls[0])" :href="safeURL(card.urls[0])" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">原始分享 ↗</a><button v-if="card.source==='manual'" class="text-button" @click="$emit('open-manual',card.originalId)">查看／規劃 →</button><span v-if="card.needsReview" class="idea-review">地點／分類待確認</span></div>
   <details class="idea-details"><summary>{{card.source==='telegram'?'原文與備註':'收藏內容'}}</summary><p v-if="card.category==='準備提醒'" class="idea-warning">這是你們的準備筆記，未核實為官方售票日，也未設定通知。</p><p class="idea-original">{{card.raw||card.summary||'還沒有補充內容'}}</p><a v-for="url in card.urls.slice(1)" v-show="safeURL(url)" :key="url" :href="safeURL(url)" target="_blank" rel="noopener noreferrer">其他參考連結 ↗</a><div v-for="(media,index) in card.media" :key="index" class="pig-media"><button v-if="media.available&&!imageURLs[media.id]" class="quiet" @click="showImage(media)" :disabled="imageBusy[media.id]">{{imageBusy[media.id]?'載入中…':'📷 查看圖片'}}</button><a v-if="imageURLs[media.id]" :href="imageURLs[media.id]" target="_blank" rel="noopener"><img :src="imageURLs[media.id]" alt="分享圖片，點擊放大"></a><small v-if="!media.available">📎 {{media.name||'附件'}} · {{media.note}}</small></div><div class="idea-detail-footer"><span>{{card.source==='telegram'?(card.original.sender||'TG 分享'):'網站手動收藏'}} · {{date(card.createdAt)}}</span><span v-if="card.source==='telegram'">分類可在 TG 修改</span><button v-else class="text-button muted" @click="$emit('remove-manual',card.originalId)">移除收藏</button></div></details>
   </article></div><div v-if="!filtered.length" class="empty"><span>🧭</span><h3>{{cards.length?'這個篩選還沒有收藏':'先把一個想去的地方留下來'}}</h3><p>可以在 TG 丟想法，也可以用網站的「收藏一個想法」。<br v-if="!connected"><span v-if="!connected">若已經用 TG 收藏，請先用私人連結連接。</span></p><button class="quiet" @click="kind='';search='';$emit('country','')">查看全部收藏</button></div></template>
  </section>`
 };
})(globalThis);
