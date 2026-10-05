const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const TripSync = require('../assets/trip-sync.js');
const html = fs.readFileSync(path.join(__dirname, '../葡猪.html'), 'utf8');
const section = (start, end) => html.slice(html.indexOf(start), html.indexOf(end, html.indexOf(start)));
const timers = new Map(); let timerId = 0;
const expense = { item:'測試費用', splitType:'shared', isSettled:false };
const state = {
    isReadOnly:{value:false}, currentTripId:{value:'A'}, expenses:{value:[expense]}, days:{value:[]},
    expenseDeleteTarget:{value:null}, editingExpenseTarget:{value:null}, longPressTimer:{value:null},
    expenseTapTimes:new WeakMap(), expenseLongPressed:new WeakSet(), navigator:{}, TripSync,
    cancelExpenseEdit(){state.editingExpenseTarget.value=null;},
    setTimeout(fn){timers.set(++timerId,fn);return timerId;}, clearTimeout(id){timers.delete(id);}
};
const context = vm.createContext(state);
const code = 'let expenseDeleteTripId = null;\n' +
    section('const deleteExpense =', 'watch(expenseDeleteTarget,') + '\n' +
    section('const startLongPress =', 'const addTodo =') +
    '\n({deleteExpense,confirmExpenseDeletion,startLongPress,clearLongPress})';
const api = vm.runInContext(code, context);
const runTimers = () => { const work=[...timers.values()];timers.clear();work.forEach(fn=>fn()); };
state.isReadOnly.value=true;
api.startLongPress(expense);api.deleteExpense(expense);assert.equal(timers.size,0);assert.equal(state.expenseDeleteTarget.value,null);
state.isReadOnly.value=false;
api.startLongPress(expense);state.isReadOnly.value=true;runTimers();assert.equal(expense.isSettled,false);
state.isReadOnly.value=false;
api.startLongPress(expense);runTimers();assert.equal(expense.isSettled,true);
api.startLongPress(expense);state.currentTripId.value='B';runTimers();assert.equal(expense.isSettled,true);state.currentTripId.value='A';
api.deleteExpense(expense);assert.equal(state.expenses.value.length,1);assert.equal(state.expenseDeleteTarget.value,expense);
state.expenseDeleteTarget.value=null;api.confirmExpenseDeletion();assert.equal(state.expenses.value.length,1);
api.deleteExpense(expense);state.isReadOnly.value=true;api.confirmExpenseDeletion();assert.equal(state.expenses.value.length,1);
state.isReadOnly.value=false;api.deleteExpense(expense);api.confirmExpenseDeletion();assert.equal(state.expenses.value.length,0);
const main = section('<main ', '</main>');
const editors = [...main.matchAll(/<(?:input|textarea|select)\b[^>]*>/g)].map(match => match[0]);
assert(editors.every(tag => tag.includes(':disabled="isReadOnly"') || /class="[^"]*vault-browse/.test(tag)));
assert(editors.filter(tag => /class="[^"]*vault-browse/.test(tag)).every(tag => tag.includes('v-model="credentialSearch"') || tag.includes('v-model="vaultPassphrase"')));
assert(main.includes('@touchmove="clearLongPress"'));
assert(/watch\(isReadOnly, locked => \{ if \(locked\) \{?\s*cancelPendingGestures\(\);/.test(html));
assert(html.includes('.locked-mode button:not(.unlock-btn):not(.lock-toggle-btn):not(.vault-browse):not(.ledger-browse)'));
const browseButtons=[...main.matchAll(/<button\b[^>]*class="ledger-browse [^>]*>/g)].map(match=>match[0]);
assert.equal(browseButtons.length,2);
assert(browseButtons.every(tag=>/@click="ledgerSelectedPerson=(?:''|p)"/.test(tag)));
assert(browseButtons.every(tag=>tag.includes(':aria-pressed="ledgerSelectedPerson===')));
assert(!/<button\b[^>]*@click[^>]*(?:deleteExpense|addExpense|splitType)[^>]*class="ledger-browse/.test(main));
console.log('PASS locked/unlocked settlement, pending holds, trip changes, delete confirmation/cancel, locked delete, disabled fields');
