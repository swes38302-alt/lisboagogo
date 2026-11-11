const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const TripSync=require('../assets/trip-sync.js');
const html=fs.readFileSync(path.join(__dirname,'../葡猪.html'),'utf8');
const section=(start,end)=>html.slice(html.indexOf(start),html.indexOf(end,html.indexOf(start)));
const original={item:'後三晚住宿',amount:38195.24,originalAmount:8021,originalCurrency:'TWD',payer:'旅伴甲',isSettled:false,custom:'保留'};
const other={item:'其他費用',amount:100,originalAmount:100,originalCurrency:'TWD',payer:'旅伴乙'};
function fixture(records=[original,other]) {
 const state={expenses:{value:TripSync.clone(records)},editingExpenseTarget:{value:null},editingItineraryExpense:{value:false},days:{value:[]},expenseDeleteTarget:{value:null},currentTripId:{value:'A'},isReadOnly:{value:false},expenseFormError:{value:''},newExpense:{},ledgerSelectedPerson:{value:''},exchangeRate:{value:.21},settings:{currency:'¥'},TripSync,FamilyLedger:require('../assets/family-ledger.js'),participants:{value:['旅伴甲','旅伴乙']},ledgerGroups:{value:[]},ledgerPhase:e=>e.expensePhase||'before',showExpenseForm:{value:false},ledgerTab:{value:'detail'},crypto:require('node:crypto').webcrypto,getTodayDateKey:()=> '2026-11-11',clearLongPress(){},nextTick(){},watch(){}};
 const source=section('let expenseEditSession =','const setExpenseTwdAmount =')+'\n({startExpenseEdit,addExpense,cancelExpenseEdit})';
 const api=vm.runInNewContext(source,state);return {state,api};
}
function edit(f){f.api.startExpenseEdit(f.state.expenses.value[0]);f.state.newExpense.amount=7460;}
let f=fixture();edit(f);f.state.expenses.value=TripSync.clone(f.state.expenses.value);f.api.addExpense();
assert.equal(f.state.expenseFormError.value,'');assert.equal(f.state.expenses.value[0].originalAmount,7460);assert.equal(f.state.expenses.value[0].twdAmount,7460);assert.equal(f.state.expenses.value[0].amount,35523.81);assert.equal(f.state.expenses.value[0].custom,'保留');assert.deepEqual(f.state.expenses.value[1],other);assert.equal(f.state.editingExpenseTarget.value,null);
f=fixture();edit(f);f.state.expenses.value=TripSync.clone(f.state.expenses.value).reverse();f.api.addExpense();assert.equal(f.state.expenses.value[1].originalAmount,7460);assert.equal(f.state.expenses.value[0].originalAmount,100);
f=fixture();edit(f);f.state.expenses.value[0].originalAmount=7900;f.api.addExpense();assert(f.state.expenseFormError.value);assert.equal(f.state.expenses.value[0].originalAmount,7900);assert.equal(f.state.newExpense.amount,7460);
f=fixture();edit(f);f.state.expenses.value.shift();f.api.addExpense();assert(f.state.expenseFormError.value);assert.equal(f.state.expenses.value.length,1);
f=fixture([original,original]);edit(f);f.state.expenses.value=TripSync.clone(f.state.expenses.value);f.api.addExpense();assert(f.state.expenseFormError.value);assert(f.state.expenses.value.every(e=>e.originalAmount===8021));
f=fixture([{...original,id:'expense-1'},other]);edit(f);f.state.expenses.value=TripSync.clone(f.state.expenses.value).reverse();f.api.addExpense();assert.equal(f.state.expenses.value.find(e=>e.id==='expense-1').originalAmount,7460);
f=fixture();edit(f);f.state.currentTripId.value='B';f.api.addExpense();assert(f.state.expenseFormError.value);assert.equal(f.state.expenses.value[0].originalAmount,8021);
f=fixture();edit(f);f.state.isReadOnly.value=true;f.api.addExpense();assert.equal(f.state.expenses.value[0].originalAmount,8021);
f=fixture();const meal={id:25,activity:'午餐',type:'restaurant',ticket:1000,payer:'旅伴甲',isPaid:true,note:'保留餐卡與自訂內容',time:'12:00',openTime:'11:00–14:00'};f.state.days.value=[{fullDate:'2026-10-30',items:[meal]}];
f.api.startExpenseEdit(meal,true);Object.assign(f.state.newExpense,{allocationMode:'equal',allocationKeys:['p:旅伴乙'],expensePhase:'before',actualTwd:230});f.api.addExpense();assert.equal(f.state.expenseFormError.value,'');assert.equal(meal.note,'保留餐卡與自訂內容');assert.equal(meal.time,'12:00');assert.equal(meal.openTime,'11:00–14:00');assert.equal(meal.settlementTwdAmount,230);assert.equal(meal.expensePhase,'before');assert.equal(meal.allocation.entries[0].key,'p:旅伴乙');assert.equal(f.state.expenses.value.length,2);
console.log('PASS edit after sync cloning/reorder, exact TWD amount, unknown fields, remote-change/deletion/duplicate/trip/lock guards.');
