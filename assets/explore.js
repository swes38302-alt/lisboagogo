(function(){
 'use strict';
 const {createApp,ref,computed,nextTick,onMounted}=Vue,M=ExploreModel;
 createApp({setup(){
  const tab=ref('explore'),country=ref(''),month=ref(0),onlyNow=ref(false),state=ref(M.empty()),status=ref('此裝置儲存'),syncEnabled=ref(false),hasConflict=ref(false),selected=ref(null),detailTab=ref('值得體驗'),detailDialog=ref(null),customDialog=ref(null),newTask=ref(''),toast=ref(''),formError=ref(''),custom=ref({});
  const world=TravelWorld,stages=['了解中','準備中','已確定出行','已去過','擱置'],tabs=[{id:'explore',label:'探索地圖'},{id:'saved',label:'我的收藏'},{id:'plans',label:'我的規劃'},{id:'calendar',label:'準備日曆'}];
  const years=Array.from({length:10},(_,i)=>new Date().getFullYear()+i);
  let store,db,toastTimer;
  const entries=computed(()=>Object.values(state.value.entries).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)));
  const plans=computed(()=>entries.value.filter(e=>e.stage!=='收藏'));
  const countriesSorted=[...world.countries].sort((a,b)=>a.name.localeCompare(b.name,'zh-Hant'));
  const countryName=computed(()=>world.countries.find(c=>c.id===country.value)?.name||'');
  const entryFor=e=>state.value.entries[e.id];
  const eventFor=entry=>{
   if(!entry)return {};
   const seed=TravelEvents.find(e=>e.id===entry.eventId);if(seed)return seed;
   return {id:entry.id,name:entry.name||'旅行想法',country:entry.country||'',location:entry.location||world.countries.find(c=>c.id===entry.country)?.name||'地點待補',emoji:entry.kind==='節慶活動'?'🎉':entry.kind==='景點'?'📍':'🧭',months:entry.month?[Number(entry.month)]:[],season:entry.month?entry.month+' 月・個人想法':'月份尚未決定',summary:entry.note||'先把這個想法留下來，等想出發時再慢慢準備。',leadMonths:6,date:'',dateStatus:'待查核',experiences:[],facts:entry.link?[{title:'收藏的參考連結',value:'個人收藏，尚未查核年度與預約資訊。',status:'待查核',source:entry.link}]:[],tasks:[{title:'了解想體驗的內容與參與方式',kind:'研究',state:'ready'}],next:'先了解喜歡的體驗與參與方式',reason:'你收藏的想法已接近想去的月份，可以開始研究。'};
  };
  const allEvents=computed(()=>[...TravelEvents,...entries.value.filter(e=>e.id.startsWith('custom-')).map(eventFor)]);
  const upcoming=e=>M.upcoming(e);
  const filteredEvents=computed(()=>allEvents.value.filter(e=>(!country.value||e.country===country.value)&&(!month.value||e.months.includes(month.value))&&(!onlyNow.value||upcoming(e)?.recommend)));
  const recommendations=computed(()=>TravelEvents.filter(e=>upcoming(e)?.recommend).sort((a,b)=>upcoming(a).distance-upcoming(b).distance));
  const mapEvents=computed(()=>filteredEvents.value.filter(e=>e.country&&point(e)));
  const hasCountryEvents=id=>allEvents.value.some(e=>e.country===id);
  function point(e){return world.points[e.id]||world.countries.find(c=>c.id===e.country)?.center;}
  const activeEntry=computed(()=>selected.value?entryFor(selected.value):null);
  const completedTasks=computed(()=>Object.values(activeEntry.value?.tasks||{}).filter(t=>t.done).length);
  const calendarItems=computed(()=>M.calendar(state.value.entries));
  const progress=entry=>{const tasks=Object.values(entry.tasks||{});return tasks.length?100*tasks.filter(t=>t.done).length/tasks.length:0;};
  function notify(message){toast.value=message;clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.value='',2800);}
  function edit(fn){store.edit(fn);}
  function saveEvent(e){if(entryFor(e)){notify('已經在你的收藏裡');return;}edit(s=>s.entries[e.id]=M.createEntry(e));notify('已收藏，日期和預算可以慢慢想');}
  function openEvent(e){selected.value=e;detailTab.value=entryFor(e)&&entryFor(e).stage!=='收藏'?'我的準備':'值得體驗';newTask.value='';nextTick(()=>{if(!detailDialog.value.open)detailDialog.value.showModal();});}
  function startPlan(e){edit(s=>s.entries[e.id]=M.begin(s.entries[e.id]||M.createEntry(e),e));selected.value=e;detailTab.value='我的準備';nextTick(()=>{if(!detailDialog.value.open)detailDialog.value.showModal();});}
  function toggleExperience(x){if(!selected.value)return;const e=selected.value;edit(s=>{const p=M.begin(s.entries[e.id]||M.createEntry(e),e);p.experiences[x.id]=!p.experiences[x.id];s.entries[e.id]=p;});notify('已更新想體驗的內容');}
  function updateField(key,value){if(!activeEntry.value)return;const id=activeEntry.value.id;edit(s=>s.entries[id][key]=value);}
  function updateTask(id,key,value){if(!activeEntry.value)return;if(key==='date'&&value&&!M.validDate(value)){notify('請輸入有效日期');return;}if(key==='source'&&value&&!M.safeURL(value)){notify('請使用 http 或 https 的公告連結');return;}edit(s=>{s.entries[activeEntry.value.id].tasks[id][key]=value;});}
  function removeTask(id){edit(s=>delete s.entries[activeEntry.value.id].tasks[id]);}
  function addTask(){const title=newTask.value.trim();if(!title||!activeEntry.value)return;const id=M.uid();edit(s=>s.entries[activeEntry.value.id].tasks[id]={id,title,kind:'自己準備',state:'ready',date:'',dateType:'個人準備',done:false});newTask.value='';}
  function removeEntry(entry){if(!confirm('移除「'+eventFor(entry).name+'」及它的準備草稿？'))return;edit(s=>delete s.entries[entry.id]);notify('已移除收藏');}
  function openCustom(){custom.value={name:'',kind:'景點',country:country.value,month:month.value,location:'',link:'',note:''};formError.value='';customDialog.value.showModal();}
  function saveCustom(){if(!custom.value.name.trim()){formError.value='先幫這個想法取個名字';return;}if(custom.value.link&&!M.safeURL(custom.value.link)){formError.value='請使用 http 或 https 的參考連結';return;}const id='custom-'+M.uid();edit(s=>s.entries[id]={...M.createEntry({id}),...custom.value,link:M.safeURL(custom.value.link),id,eventId:id});customDialog.value.close();notify('已收藏你的旅行想法');tab.value='saved';}
  function closeOnBackdrop(event,dialog){if(event.target!==dialog)return;const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();}
  function exportBackup(){const value={app:'lisboagogo-travel-ideas',exportedAt:new Date().toISOString(),data:store.getSnapshot()};const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='旅行靈感備份-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function getDb(){if(db)return db;const config={apiKey:'AIzaSyC_mIkGuJCMKAcoRf78bipUJzzodTk_zVs',authDomain:'lisboaaa-2c65b.firebaseapp.com',databaseURL:'https://lisboaaa-2c65b-default-rtdb.firebaseio.com',projectId:'lisboaaa-2c65b',appId:'1:391483387676:web:d527043aee656dfc5854d9'};db=firebase.initializeApp(config,'travel-inspiration').database();return db;}
  function syncPreference(value){try{localStorage.setItem(M.STORAGE_KEY+':sync',value?'yes':'no');}catch{}}
  function connect(){try{store.connect(getDb());syncEnabled.value=true;syncPreference(true);}catch{status.value='暫時無法連上雲端，資料保留在此裝置。';}}
  function toggleSync(){if(syncEnabled.value){store.disconnect();syncEnabled.value=false;syncPreference(false);return;}if(confirm('啟用共用旅行靈感？\n\n開啟後，同一網站的共用區域可以在不同裝置查看與編輯。現有旅程資料不會搬動。這個區域不使用個別旅程的鎖定密碼。'))connect();}
  function retrySync(){store.disconnect();syncEnabled.value=false;connect();}
  function acceptRemote(){if(confirm('以雲端版本取代此裝置草稿？如果有未同步修改，請先下載備份。'))store.acceptRemote();}
  store=ExploreStore.create({storage:localStorage,merge:TripSync.merge,onChange:s=>state.value=s,onStatus:message=>{status.value=message;hasConflict.value=!!store?.getConflicts().length;}});
  onMounted(()=>{try{if(localStorage.getItem(M.STORAGE_KEY+':sync')==='yes')connect();}catch{}});
  return {tab,country,month,onlyNow,state,status,syncEnabled,hasConflict,selected,detailTab,detailDialog,customDialog,newTask,toast,formError,custom,world,stages,tabs,years,entries,plans,countriesSorted,countryName,entryFor,eventFor,upcoming,filteredEvents,recommendations,mapEvents,hasCountryEvents,point,activeEntry,completedTasks,calendarItems,progress,safeURL:M.safeURL,saveEvent,openEvent,startPlan,toggleExperience,updateField,updateTask,removeTask,addTask,removeEntry,openCustom,saveCustom,closeOnBackdrop,exportBackup,toggleSync,retrySync,acceptRemote};
 }}).mount('#explore-app');
})();
