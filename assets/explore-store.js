/* Local draft + opt-in global synchronization. All cloud writes are isolated. */
(function(root){
 function create({storage,merge,onChange=()=>{},onStatus=()=>{}}){
  const M=root.ExploreModel;let base=M.empty(),draft=M.empty(),ref=null,saving=false,enabled=false,conflicts=[],timer=null,listener=null,connectedRef=null,connectedListener=null;
  try{const stored=JSON.parse(storage.getItem(M.STORAGE_KEY)||'null');if(stored){base=M.normalize(stored.base);draft=M.normalize(stored.draft);}}catch{onStatus('無法讀取本機資料，請先匯出備份後再繼續。');}
  function persist(){try{storage.setItem(M.STORAGE_KEY,JSON.stringify({base,draft}));}catch{onStatus('本機儲存空間不足；請下載備份。');}onChange(M.clone(draft));}
  function changed(){return !root.TripSync.equal(base,draft);}
  function schedule(){clearTimeout(timer);if(enabled&&ref&&!conflicts.length&&changed())timer=setTimeout(flush,400);}
  function edit(fn){const next=M.clone(draft);fn(next);draft=M.normalize(next);persist();schedule();}
  function receive(snapshot){
   const raw=snapshot.val();if(raw&&raw.version!==1){onStatus('雲端資料版本不相容，已保留本機草稿。');enabled=false;return;}
   const remote=M.normalize(raw);const result=merge(base,draft,remote);base=remote;draft=M.normalize(result.value);conflicts=result.conflicts;persist();
   onStatus(conflicts.length?'同一項資料有不同修改，已保留本機草稿；請下載備份或載入雲端版本。':changed()?'有修改等待同步':'已同步・共用旅行靈感');schedule();
  }
  async function flush(){
   if(saving||!enabled||!ref||conflicts.length||!changed())return;
   saving=true;const before=M.clone(base),sent=M.clone(draft);let collision=[],acknowledged=false;
   try{
    const result=await ref.transaction(current=>{
     if(current&&current.version!==1){collision=['version'];return;}
     const combined=merge(before,sent,M.normalize(current));collision=combined.conflicts;if(collision.length)return;return combined.value;
    },undefined,false);
    if(result.committed){acknowledged=true;const remote=M.normalize(result.snapshot.val());const rebase=merge(sent,draft,remote);base=remote;draft=M.normalize(rebase.value);conflicts=rebase.conflicts;persist();onStatus(conflicts.length?'資料有不同修改，已保留本機草稿':'已同步・共用旅行靈感');}
    else{conflicts=collision.length?collision:['transaction'];onStatus('同一項資料有不同修改，已保留本機草稿；請下載備份或載入雲端版本。');}
   }catch{onStatus('雲端同步失敗，修改已保留在此裝置；可重試或下載備份。');}
   finally{saving=false;}
   if(acknowledged&&enabled&&!conflicts.length&&changed())schedule();
  }
  function disconnect(){enabled=false;clearTimeout(timer);if(ref&&listener)ref.off('value',listener);if(connectedRef&&connectedListener)connectedRef.off('value',connectedListener);ref=null;listener=null;onStatus('此裝置儲存');}
  function connect(db){if(enabled)return;enabled=true;ref=db.ref(M.CLOUD_PATH);listener=receive;ref.on('value',listener,()=>{onStatus('雲端讀取失敗，資料保留在此裝置；請重試同步。');});connectedRef=db.ref('.info/connected');connectedListener=snapshot=>{if(!snapshot.val())onStatus('目前離線・此裝置保留草稿');else if(!conflicts.length){onStatus('正在確認共用資料…');schedule();}};connectedRef.on('value',connectedListener);}
  async function acceptRemote(){if(!ref)return;try{const raw=(await ref.get()).val();if(raw&&raw.version!==1)throw new Error('version');base=M.normalize(raw);draft=M.clone(base);conflicts=[];persist();onStatus('已載入雲端版本');}catch{onStatus('載入失敗，已保留本機草稿。');}}
  onChange(M.clone(draft));
  return {edit,connect,disconnect,flush,acceptRemote,getSnapshot:()=>M.clone(draft),getConflicts:()=>conflicts.slice()};
 }
 root.ExploreStore={create};if(typeof module!=='undefined'&&module.exports)module.exports={create};
})(globalThis);
