const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const TripSync=require('../assets/trip-sync.js');
const html=fs.readFileSync(path.join(__dirname,'../葡猪.html'),'utf8');
const section=(start,end)=>html.slice(html.indexOf(start),html.indexOf(end,html.indexOf(start)));
const original={item:'後三晚住宿',amount:38195.24,originalAmount:8021,originalCurrency:'TWD',payer:'旅伴甲',isSettled:false,custom:'保留'};
const other={item:'其他費用',amount:100,originalAmount:100,originalCurrency:'TWD',payer:'旅伴乙'};
function fixture(records=[original,other]) {
 const state={expenses:{value:TripSync.clone(records)},editingExpenseTarget:{value:null},expenseDeleteTarget:{value:null},currentTripId:{value:'A'},isReadOnly:{value:false},expenseFormError:{value:''},newExpense:{},ledgerSelectedPerson:{value:''},exchangeRate:{value:.21},settings:{currency:'¥'},TripSync,clearLongPress(){},nextTick(){},watch(){}};
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
console.log('PASS edit after sync cloning/reorder, exact TWD amount, unknown fields, remote-change/deletion/duplicate/trip/lock guards.');
