(function(root){
 'use strict';
 const {ref,computed,watch,onMounted,onUnmounted,nextTick}=Vue,L=IdeaLibraryModel,C=PigInboxCrypto,privateUse=PigInbox.use;
 root.PigInbox={use:privateUse,
  props:{controller:Object,view:String,countryId:String,cards:Array,world:Object},emits:['country','open-manual','remove-manual','explore'],
  setup(props,{emit}){
   const scope=ref(''),group=ref(''),subtype=ref(''),search=ref(''),detailId=ref(''),settings=ref(false),imageDialog=ref(null),activeImage=ref('');
   const i=props.controller,all=computed(()=>props.cards.map(L.present)),countryCards=computed(()=>all.value.filter(c=>c.countryId===props.countryId));
   const countryName=computed(()=>props.world.countries.find(c=>c.id===props.countryId)?.name||'收藏');
   const countries=computed(()=>{const result=PigIdeaModel.counts(all.value,props.world);if(all.value.some(c=>!c.countryId))result.push({id:'@inbox',name:'收件匣',count:all.value.filter(c=>!c.countryId).length});return result.sort((a,b)=>a.name.localeCompare(b.name,'zh-Hant'));});
   const scopedCards=computed(()=>props.countryId==='@inbox'?all.value.filter(c=>!c.countryId):L.filter(countryCards.value,{scope:scope.value}));
   const scopes=computed(()=>L.scopes(countryCards.value));
   const groups=computed(()=>L.GROUPS.map(g=>({...g,count:scopedCards.value.filter(c=>c.tags.some(t=>t.startsWith(g.name+'／'))).length})).filter(g=>g.count));
   const subtypes=computed(()=>{const g=L.GROUPS.find(g=>g.name===group.value);return(g?.subtypes||[]).filter(s=>scopedCards.value.some(c=>c.tags.includes(group.value+'／'+s)));});
   const filtered=computed(()=>L.filter(scopedCards.value,{group:group.value,subtype:subtype.value,search:search.value}));
   const selected=computed(()=>all.value.find(c=>c.id===detailId.value&&(props.countryId==='@inbox'?!c.countryId:c.countryId===props.countryId))||null);
   const scopeName=computed(()=>scope.value==='@country'?'全國靈感與心願':scope.value==='@places'?'地點收藏':scope.value);
   const scopeChosen=computed(()=>!!scope.value||props.countryId==='@inbox');
   function reset(){scope.value='';group.value='';subtype.value='';search.value='';detailId.value='';}
   watch(()=>props.countryId,reset);
   watch(()=>i.connected.value,(value,old)=>{if(!value&&old){detailId.value='';activeImage.value='';imageDialog.value?.close();}});
   function goCountries(){reset();emit('country','');}
   function goScopes(){scope.value='';group.value='';subtype.value='';detailId.value='';search.value='';}
   function goGroups(){group.value='';subtype.value='';detailId.value='';search.value='';}
   function openScope(id){scope.value=id;group.value='';subtype.value='';search.value='';detailId.value='';}
   function openGroup(name){group.value=name;subtype.value='';search.value='';detailId.value='';}
   async function openCard(card){detailId.value=card.id;for(const media of card.media||[])if(media.available)await i.showImage(media);}
   async function openImage(media){await i.showImage(media);const url=i.imageURLs.value[media.id];if(url){activeImage.value=url;await nextTick();imageDialog.value.showModal();}}
   const date=value=>{if(!value)return '';const m=String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);return m?m.slice(1).join('/'):'';};
   const experienceMeta=r=>[date(r.date),r.amount!==''&&r.amount!=null?[r.currency,r.amount].filter(v=>v!==''&&v!=null).join(' '):'',r.verdict].filter(Boolean).join(' · ');
   const map=card=>TripMapLinks.build({location:card.mapQuery},{mapProvider:card.countryId==='KOR'?'naver':'google'});
   let navigation;onMounted(()=>{navigation=TripMapLinks.createNavigation({window,document,navigator});document.addEventListener('click',navigation.handleClick);});onUnmounted(()=>{document.removeEventListener('click',navigation.handleClick);navigation.dispose();});
   return {...i,scope,group,subtype,search,detailId,settings,imageDialog,activeImage,all,countryCards,countryName,countries,scopes,groups,subtypes,filtered,selected,scopeName,scopeChosen,goCountries,goScopes,goGroups,openScope,openGroup,openCard,openImage,date,experienceMeta,map,safeURL:C.safeURL};
  },
  template:`<section v-show="view==='explore'||view==='saved'" class="travel-library" aria-label="旅行收藏">
   <div class="library-connection"><span role="status"><i :class="['status-dot',{online:connected}]"></i>{{message}}</span><button class="text-button" @click="settings=!settings">{{settings?'收起':'連線設定'}}</button></div>
   <section v-if="settings" class="library-settings"><form v-if="!connected" @submit.prevent="connect"><label>私人鑰匙<input type="password" v-model.trim="secret" autocomplete="off"></label><button class="quiet" :disabled="busy">連接</button></form><div v-else class="library-actions"><button class="quiet" @click="refresh" :disabled="busy">更新</button><button class="quiet" @click="remember" :disabled="remembered">{{remembered?'已記住此裝置':'記住此裝置'}}</button><button class="quiet" @click="exportPrivate">備份</button><button class="text-button" @click="disconnect">中斷連線</button></div><small v-if="lastUpdate">{{lastUpdate}}</small></section>
   <template v-if="view==='saved'">
    <nav class="library-breadcrumb" aria-label="收藏層級"><button @click="goCountries" :aria-current="!countryId?'page':undefined">國家</button><template v-if="countryId"><span>›</span><button @click="goScopes">{{countryId==='@inbox'?'收件匣':countryName}}</button></template><template v-if="scope"><span>›</span><button @click="goGroups">{{scopeName}}</button></template><template v-if="group"><span>›</span><button @click="detailId='';subtype=''">{{group}}</button></template><span v-if="selected">› {{selected.title}}</span></nav>
    <div v-if="!countryId" class="library-folders"><button v-for="c in countries" :key="c.id" class="library-folder" @click="$emit('country',c.id)"><strong>{{c.name}}</strong><small>{{c.count}} 則收藏</small></button></div>
    <template v-else-if="!scopeChosen"><button v-for="s in scopes.filter(s=>s.id==='@country')" :key="s.id" class="library-folder library-country-wish" @click="openScope(s.id)"><strong>✨ {{s.name}}</strong><small>{{s.count}} 則收藏</small></button><div class="library-folders"><button v-for="s in scopes.filter(s=>s.id!=='@country')" :key="s.id" class="library-folder" @click="openScope(s.id)"><strong>{{s.name}}</strong><small>{{s.count}} 則收藏</small></button></div></template>
    <div v-else-if="!group&&!selected" class="library-folders"><button v-for="g in groups" :key="g.name" class="library-folder" @click="openGroup(g.name)"><strong>{{g.emoji}} {{g.name}}</strong><small>{{g.count}} 則收藏</small></button></div>
    <template v-else-if="!selected"><div class="library-filters"><div class="library-chips" role="group" aria-label="小分類"><button :aria-pressed="!subtype" @click="subtype=''">全部</button><button v-for="s in subtypes" :key="s" :aria-pressed="subtype===s" @click="subtype=s">{{s}}</button></div><input type="search" v-model="search" aria-label="搜尋收藏" placeholder="搜尋"></div><div class="library-list"><button v-for="card in filtered" :key="card.id" class="library-row" @click="openCard(card)"><span><strong>{{card.title}}</strong><small v-if="card.city">{{card.city}}</small><span class="library-tags"><span v-for="t in card.tags" :key="t">{{t}}</span></span></span><span aria-hidden="true">›</span></button></div><p v-if="!filtered.length" class="library-empty">沒有符合的收藏</p></template>
    <article v-else class="library-detail"><button class="text-button library-back" @click="detailId=''">← 返回清單</button><header><h2>{{selected.title}}</h2><p v-if="selected.city" class="library-location">{{selected.city}}</p><div v-if="selected.tags.length" class="library-tags"><span v-for="t in selected.tags" :key="t">{{t}}</span></div></header><p v-if="selected.summary" class="library-content">{{selected.summary}}</p><p v-if="selected.address" class="library-address">{{selected.address}}</p><div class="library-actions"><a v-if="selected.mapQuery" :href="map(selected).href" :data-naver-app="map(selected).appUrl||undefined" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">📍 {{selected.countryId==='KOR'?'NAVER 地圖':'Google 地圖'}} ↗</a><a v-for="url in selected.urls.filter(u=>safeURL(u))" :key="url" :href="safeURL(url)" target="_blank" rel="noopener noreferrer">原始連結 ↗</a></div>
     <p v-for="(note,index) in selected.cautions||[]" :key="index" class="library-caution">{{note}}</p>
     <section v-if="selected.experiences.length" class="library-experiences" aria-label="體驗紀錄"><h3>自己的體驗</h3><article v-for="r in selected.experiences" :key="r.id"><strong v-if="r.city||r.place">{{[r.city,r.place].filter(Boolean).join('・')}}</strong><small v-if="experienceMeta(r)">{{experienceMeta(r)}}</small><p v-if="r.review" class="library-content">{{r.review}}</p></article></section>
     <div v-if="selected.media.some(m=>m.available)" class="library-photos"><template v-for="(media,index) in selected.media" :key="media.id||index"><button v-if="media.available&&imageURLs[media.id]" @click="openImage(media)" aria-label="放大照片"><img :src="imageURLs[media.id]" alt="收藏照片" loading="lazy"></button></template></div>
     <details v-if="selected.raw.trim()||selected.media.some(m=>!m.available)" class="library-original"><summary>原始分享</summary><p v-if="selected.raw.trim()" class="library-content">{{selected.raw}}</p><small v-for="(m,index) in selected.media.filter(m=>!m.available)" :key="index">📎 {{m.name||'附件'}}</small></details>
    </article>
    <p v-if="!all.length" class="library-empty">尚無收藏</p>
   </template>
   <dialog ref="imageDialog" class="library-lightbox"><button class="quiet" @click="imageDialog.close()" aria-label="關閉照片">關閉</button><img v-if="activeImage" :src="activeImage" alt="收藏照片"></dialog>
  </section>`
 };
})(globalThis);
