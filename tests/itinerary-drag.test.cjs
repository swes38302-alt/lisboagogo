const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const TripSync=require('../assets/trip-sync.js');
const html=fs.readFileSync(path.join(__dirname,'../葡猪.html'),'utf8');
const start=html.indexOf('const finishItineraryDrag ='),end=html.indexOf('const initTripSortable =',start);
assert(start>0 && end>start);
function harness(){
 const queued=[],classes=new Set();let instance,destroys=0,reloads=0,ghost=true,writes=0;
 const items=[1,2,3].map(id=>({id,note:'保留 '+id,connected:true}));let list=items;
 const day={fullDate:'2026-11-01'};Object.defineProperty(day,'items',{get:()=>list,set:value=>{writes++;list=value;},enumerable:true});
 const el={children:[],appendChild(node){this.children.splice(this.children.indexOf(node),1);this.children.push(node);}};
 el.children=items.map(item=>({id:item.id,parentNode:el,matches:()=>true,classList:{remove(){}},style:{removeProperty(){}}}));
 const state={TripSync,currentTripId:{value:'A'},currentDay:{value:day},viewMode:{value:'plan'},isReadOnly:{value:false},syncMessage:{value:''},navigator:{},nextTick:fn=>queued.push(fn),resizeAllTextareas(){},
  document:{visibilityState:'visible',body:{classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)}},getElementById:()=>el,querySelectorAll:()=>ghost?[{remove(){ghost=false;}}]:[]},
  loadCurrentTripData(){reloads++;state.reload?.();},
  Sortable:class {constructor(element,options){this.el=element;this.options=options;instance=this;}option(name,value){this.options[name]=value;}destroy(){destroys++;}}
 };
 const api=vm.runInNewContext('let itineraryDragSession=null,deferredDragTripReload=null,sortableInitQueued=false,sortableInstance;\n'+html.slice(start,end)+'\n({initSortable,cancelItineraryDrag,handleDragVisibility,defer(){deferredDragTripReload="A";}})',state);
 const flush=()=>{let n=0;while(queued.length){assert(n++<30);queued.shift()();}};
 api.initSortable();flush();
 return {api,state,day,el,classes,flush,get options(){return instance.options;},get counts(){return {destroys,reloads,ghost,writes};}};
}
let h=harness();const original=h.options;h.api.initSortable();h.flush();assert.equal(h.options,original);assert.equal(h.counts.destroys,0);
h.options.onChoose();h.options.onStart();h.api.initSortable();h.flush();assert.equal(h.counts.destroys,0);
h.el.appendChild(h.el.children[0]);h.api.defer();h.state.reload=()=>{h.day.items[2].note='遠端新備註';};h.options.onEnd({oldDraggableIndex:0,newDraggableIndex:2});h.flush();
assert.deepEqual(Array.from(h.day.items,i=>i.id),[2,3,1]);assert.deepEqual(h.el.children.map(i=>i.id),[1,2,3]);assert.equal(h.day.items.find(i=>i.id===3).note,'遠端新備註');assert.equal(h.counts.writes,1);assert.equal(h.counts.reloads,1);assert.equal(h.counts.ghost,false);assert.equal(h.classes.size,0);
h=harness();h.options.onChoose();h.options.onStart();h.api.defer();h.state.reload=()=>{h.day.items=[...h.day.items].reverse();};h.options.onEnd({oldIndex:0,newIndex:2});h.flush();assert.deepEqual(Array.from(h.day.items,i=>i.id),[3,2,1]);assert(h.state.syncMessage.value);
h=harness();h.options.onChoose();h.options.onStart();h.api.cancelItineraryDrag();h.flush();assert.equal(h.classes.size,0);assert.equal(h.counts.ghost,false);assert.equal(h.counts.writes,0);assert.deepEqual(h.day.items.map(i=>i.id),[1,2,3]);
h=harness();h.options.onChoose();h.options.onStart();h.state.isReadOnly.value=true;h.options.onEnd({oldIndex:0,newIndex:2});h.flush();assert.equal(h.counts.writes,0);assert.equal(h.classes.size,0);
h=harness();h.options.onChoose();h.options.onStart();h.state.currentTripId.value='B';h.options.onEnd({oldIndex:0,newIndex:2});h.flush();assert.equal(h.counts.writes,0);
h=harness();h.options.onChoose();h.options.onStart();h.options.onEnd({oldIndex:undefined,newIndex:2});h.flush();assert.equal(h.counts.writes,0);
h=harness();h.options.onChoose();h.options.onUnchoose();h.flush();assert.equal(h.counts.ghost,false);assert.equal(h.counts.writes,0);
assert(html.includes('if (itineraryDragSession) { deferredDragTripReload = currentTripId.value; return; }'));
assert(html.includes("document.addEventListener('touchcancel', cancelItineraryDrag)"));
console.log('PASS instance reuse, deferred reload, atomic stable-ID reorder, concurrent order protection, cancellation/lock/trip/invalid-index cleanup.');
