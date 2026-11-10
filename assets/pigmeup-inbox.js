(function(root){
 'use strict';
 const {ref,computed,onMounted,onUnmounted}=Vue,C=PigInboxCrypto;
 root.PigInbox={
  setup(){
   const secret=ref(''),connected=ref(false),busy=ref(false),message=ref('尚未連接 Pig Me Up'),items=ref([]),country=ref(''),kind=ref(''),search=ref(''),lastUpdate=ref(''),imageURLs=ref({}),imageBusy=ref({}),remembered=ref(false);
   let ctx=null,timer=null,generation=0;
   const countries=computed(()=>[...new Set(items.value.map(i=>i.classification?.country||'待分類'))].sort((a,b)=>a.localeCompare(b,'zh-Hant')));
   const kinds=['景點','美食','咖啡','購物','住宿','交通','撇步','準備提醒','待分類'];
   const icons={'景點':'📍','美食':'🍽️','咖啡':'☕','購物':'🛍️','住宿':'🏡','交通':'🚗','撇步':'💡','準備提醒':'🗓️','待分類':'📥'};
   const filtered=computed(()=>items.value.filter(i=>(!country.value||(i.classification?.country||'待分類')===country.value)&&(!kind.value||(i.classification?.category||'待分類')===kind.value)&&(!search.value||[i.raw,i.sender,i.classification?.city,...(i.urls||[])].join(' ').toLowerCase().includes(search.value.toLowerCase()))));
   const waiting=computed(()=>items.value.filter(i=>i.classification?.needsReview).length);
   const date=value=>{const d=new Date(value);if(!Number.isFinite(d.getTime()))return '';return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;};
   function clearImages(){Object.values(imageURLs.value).forEach(u=>URL.revokeObjectURL(u));imageURLs.value={};}
   async function refresh(){
    if(!ctx||busy.value)return;busy.value=true;const ticket=generation,current=ctx;
    try{
     const bytes=await C.read(current,'index');if(ticket!==generation)return;
     if(!bytes){message.value='已連接，等待電腦完成第一次同步。';return;}
     const data=JSON.parse(C.decode(bytes));if(data.version!==1||!Array.isArray(data.items))throw new Error('format');
     items.value=data.items.filter(i=>i&&typeof i.id==='string'&&typeof i.raw==='string').sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
     lastUpdate.value=new Date().toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'});message.value='已解密載入・查看的是旅行靈感，不是正式行程';
    }catch{if(ticket===generation)message.value='暫時讀取失敗，或私人連結不符。已載入內容仍保留，可稍後重試。';}
    finally{if(ticket===generation)busy.value=false;}
   }
   async function connect(){
    if(busy.value)return;busy.value=true;
    try{
     const next=await C.context(secret.value.trim());generation++;clearImages();ctx=next;connected.value=true;message.value='正在讀取並解密私人收件匣…';
     try{sessionStorage.setItem('pigmeup:private-key',secret.value.trim());}catch{}
     busy.value=false;await refresh();clearInterval(timer);timer=setInterval(()=>{if(!document.hidden)refresh();},30000);
    }catch{message.value='請從電腦右下角 Pig Me Up 選單取得完整私人連結。';busy.value=false;}
   }
   function disconnect(){generation++;ctx=null;clearInterval(timer);clearImages();connected.value=false;busy.value=false;items.value=[];secret.value='';remembered.value=false;message.value='已在此裝置斷開連線';try{sessionStorage.removeItem('pigmeup:private-key');localStorage.removeItem('pigmeup:private-key');}catch{}}
   function remember(){try{localStorage.setItem('pigmeup:private-key',secret.value.trim());remembered.value=true;message.value='此裝置已記住私人連線；共用電腦請勿使用。';}catch{message.value='瀏覽器不允許儲存，請保管原本的私人連結。';}}
   async function showImage(media){
    if(!ctx||!media.available||!/^[a-f0-9]{64}$/.test(media.id)||imageURLs.value[media.id])return;
    const ticket=generation,current=ctx;imageBusy.value={...imageBusy.value,[media.id]:true};
    try{const bytes=await C.read(current,'media/'+media.id);if(ticket!==generation||!bytes)return;imageURLs.value={...imageURLs.value,[media.id]:URL.createObjectURL(new Blob([bytes],{type:'image/jpeg'}))};}
    catch{message.value='圖片暫時無法載入，原始附件仍保存在接收電腦。';}
    finally{imageBusy.value={...imageBusy.value,[media.id]:false};}
   }
   function exportPrivate(){const a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify({app:'PigMeUp-private-inbox',version:1,items:items.value},null,2)],{type:'application/json'}));a.href=u;a.download='PigMeUp-私人靈感備份.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
   function loadLink(){const key=new URLSearchParams(location.hash.slice(1)).get('pig');if(!key)return;if(connected.value)disconnect();secret.value=key;connect();history.replaceState(null,'',location.pathname+location.search+'#inbox');}
   onMounted(()=>{window.addEventListener('hashchange',loadLink);if(location.hash.startsWith('#pig=')){loadLink();return;}let key='';try{key=localStorage.getItem('pigmeup:private-key')||sessionStorage.getItem('pigmeup:private-key')||'';remembered.value=!!localStorage.getItem('pigmeup:private-key');}catch{}if(key){secret.value=key;connect();}});
   onUnmounted(()=>{window.removeEventListener('hashchange',loadLink);generation++;clearInterval(timer);clearImages();});
   return {secret,connected,busy,message,items,country,kind,search,lastUpdate,imageURLs,imageBusy,remembered,countries,kinds,icons,filtered,waiting,date,connect,refresh,disconnect,remember,showImage,exportPrivate,safeURL:C.safeURL};
  },
  template:`<section class="pig-inbox" aria-label="Pig Me Up TG 收件匣">
   <div class="pig-heading"><div><div class="eyebrow">PIG ME UP · A LITTLE IDEA, A FUTURE TRIP</div><h2>🐷 丟進群組，慢慢變成旅行。</h2><p>景點、好吃的、購票線索，先收在這裡。不會更動已排好的旅程。</p></div><span class="pig-private">🔐 私人加密收件匣</span></div>
   <div v-if="!connected" class="pig-connect"><h3>連接你們的 PigMeUpBot</h3><p>在接收電腦右下角的 Pig Me Up 選單，選「開啟旅行靈感」；手機則開啟同一份私人連結。</p><form @submit.prevent="connect"><label>私人鑰匙<input type="password" v-model.trim="secret" autocomplete="off" placeholder="通常由私人連結自動帶入，不是 BotFather Token"></label><button class="primary" :disabled="busy">連接收件匣</button></form><small>沒有額外 AI 費用。私人連結就像鑰匙，只分享給同行的人。</small></div>
   <div class="pig-status" role="status"><span>{{message}}</span><span v-if="connected">{{items.length}} 則 · {{waiting}} 則待確認<span v-if="lastUpdate"> · {{lastUpdate}} 更新</span></span></div>
   <template v-if="connected"><div class="pig-actions"><button class="quiet" @click="refresh" :disabled="busy">{{busy?'更新中…':'↻ 更新'}}</button><button class="quiet" @click="remember" :disabled="remembered">{{remembered?'此裝置已記住 ✓':'記住此裝置'}}</button><button class="text-button" @click="exportPrivate">下載 TG 備份</button><button class="text-button muted" @click="disconnect">斷開連線</button></div>
   <div class="pig-filters"><label>國家<select v-model="country"><option value="">全部國家</option><option v-for="c in countries" :key="c">{{c}}</option></select></label><label>分類<select v-model="kind"><option value="">全部分類</option><option v-for="k in kinds" :key="k">{{k}}</option></select></label><label class="pig-search">搜尋<input v-model="search" type="search" placeholder="店名、城市、分享的內容…"></label></div>
   <div class="pig-cards"><article v-for="item in filtered" :key="item.id" class="pig-card"><div class="pig-card-top"><span class="tag">{{icons[item.classification?.category]||'📥'}} {{item.classification?.category||'待分類'}}</span><span class="pig-date">{{date(item.createdAt)}}</span></div><h3>{{[item.classification?.country,item.classification?.city].filter(Boolean).join('・')||'地點待分類'}}</h3><p class="pig-raw">{{item.raw||'先收下一張圖片，等靈感慢慢成形。'}}</p><div v-if="item.preparationHints?.length" class="pig-hints"><strong>🗓️ 準備線索</strong><p v-for="(hint,index) in item.preparationHints" :key="index">{{hint.text}}</p><small>你們提供的筆記・尚未核實・未設定通知。沒有年份或精確日期就先留白。</small></div><div class="pig-links"><a v-for="url in item.urls" v-show="safeURL(url)" :key="url" :href="safeURL(url)" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">查看原始分享 ↗ <small>{{safeURL(url).slice(0,80)}}</small></a></div><div v-for="(media,index) in item.media" :key="index" class="pig-media"><button v-if="media.available&&!imageURLs[media.id]" class="quiet" @click="showImage(media)" :disabled="imageBusy[media.id]">{{imageBusy[media.id]?'圖片解密中…':'📷 查看圖片'}}</button><a v-if="imageURLs[media.id]" :href="imageURLs[media.id]" target="_blank" rel="noopener"><img :src="imageURLs[media.id]" alt="群組分享的圖片；點擊放大" loading="lazy"></a><small v-if="!media.available">📎 {{media.name||'附件'}} · {{media.note}}</small></div><footer><span>{{item.sender||'群組分享'}}<span v-if="item.duplicate"> · 重複連結，備註仍保留</span></span><span>{{item.classification?.needsReview?'待確認':'規則初分／已手動調整'}}</span></footer></article></div><div v-if="!filtered.length" class="empty"><span>📥</span><h3>{{items.length?'換個分類找找看':'先丟一個旅行想法進 TG 吧'}}</h3><p>電腦連網並持續接收時，這裡約每 30 秒檢查更新。分類可在 TG 按鈕修正。</p></div><p class="pig-footnote">收件匣只讀，不會改動原有收藏、規劃與行程。分類用關鍵字，不是 AI；圖片不做文字辨識。需要保留資料時，請下載私人備份。</p></template>
  </section>`
 };
})(globalThis);
