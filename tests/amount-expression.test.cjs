const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const A=require('../assets/amount-expression.js');
test('money calculator handles requested expression, precedence, decimals and grouping',()=>{
 for(const [formula,value] of [['216*3',648],['216×3',648],['２１６＊３',648],['100+20*3',160],['(216+24)*3',720],['1,000-200',800],['100÷4',25],['.5*6',3],['0.1+0.2',.3],['1.005*1',1.01],['216 / (2+1)',72],['-5+10',5]])assert.equal(A.calculate(formula),value,formula);
});
test('invalid/unfinished expressions never run code or silently produce a partial value',()=>{
 for(const input of ['',null,'216*','2(3)','1 2','1,2','2**3','1/0','10/(1-1)','Infinity','NaN','1e3','alert(1)','globalThis.x=1','(()=>123)()','2;123','1'.repeat(200)])assert.throws(()=>A.calculate(input),undefined,String(input));
 assert.equal(A.preview('216*').value,null);assert.equal(A.preview('216*3').expression,true);assert.equal(A.preview(648).expression,false);assert.equal(A.calculate(648),648);
});
test('split switches preserve selected people and immediately expose custom amount fields',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../葡猪.html'),'utf8');const source=html.slice(html.indexOf('const setLedgerAllocationMode ='),html.indexOf('const ledgerFormulaPreview ='));
 const state={isReadOnly:{value:false},newExpense:{allocationMode:'equal',allocationKeys:['p:A','p:B']},expenseFormError:{value:''},participants:{value:['A','B','C']},FamilyLedger:require('../assets/family-ledger.js')};
 const change=vm.runInNewContext(source+'\nsetLedgerAllocationMode',state);change('amount');assert.deepEqual(Array.from(state.newExpense.allocationKeys),['p:A','p:B']);
 change('all');change('amount');assert.deepEqual(Array.from(state.newExpense.allocationKeys),['p:A','p:B','p:C']);state.isReadOnly.value=true;change('all');assert.equal(state.newExpense.allocationMode,'amount');
 assert(html.includes("label:'選人均分'"));assert(html.includes("label:'各填金額'"));assert(html.includes('ledgerAllocationDetails(exp).length>1'));assert(html.includes('class="ledger-expense-single"'));
});
test('calculator commit supports all money fields and respects the lock',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../葡猪.html'),'utf8');const source=html.slice(html.indexOf('const commitLedgerAmount ='),html.indexOf('const openLedgerGroup ='));
 const state={isReadOnly:{value:false},newExpense:{amount:'216*3',actualTwd:'300+348',allocationAmounts:{A:'216*2'}},expenseFormError:{value:''},AmountExpression:A,ledgerCalculatedFields:{}};
 const commit=vm.runInNewContext(source+'\ncommitLedgerAmount',state);commit('amount');commit('actualTwd');commit('allocation','A');assert.equal(state.newExpense.amount,648);assert.equal(state.newExpense.actualTwd,648);assert.equal(state.newExpense.allocationAmounts.A,432);
 state.isReadOnly.value=true;state.newExpense.amount='216*4';commit('amount');assert.equal(state.newExpense.amount,'216*4');
});
