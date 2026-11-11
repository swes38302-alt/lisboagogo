const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const L=require('../assets/family-ledger.js'),Sync=require('../assets/trip-sync.js');
const people=['我','欣兒','家人甲','家人乙','別人'];
const groups=[{id:'family',name:'欣兒一家',members:['欣兒','家人甲','家人乙'],representative:'欣兒'}];
const row=(twd,payer='我',allocation=null)=>({title:'eSIM',twd,payer,allocation});
const make=(mode,keys,amounts={},total=648)=>L.makeAllocation(mode,keys,amounts,total,people,groups);
const net=result=>Object.values(result.balances).reduce((n,v)=>n+v,0);
test('eSIM only three users, representative pays 648; others owe nothing',()=>{
 const a=make('equal',['p:欣兒','p:家人甲','p:家人乙']);const c=L.calculate(people,groups,[row(648,'我',a)]);
 assert.equal(c.transactions.length,1);assert.equal(c.transactions[0].from,'欣兒');assert.equal(c.transactions[0].to,'我');assert.equal(c.transactions[0].twdAmount,648);
 assert.equal(c.summary.find(p=>p.name==='別人').owedTwd,0);assert(c.summary.filter(p=>groups[0].members.includes(p.name)).every(p=>p.owedTwd===216));assert.equal(net(c),0);
});
test('unequal cost shares are preserved independently from checkout grouping',()=>{
 const a=make('amount',['p:欣兒','p:家人甲','p:家人乙'],{'p:欣兒':200,'p:家人甲':216,'p:家人乙':232});
 const c=L.calculate(people,groups,[row(648,'我',a)]);assert.deepEqual(c.summary.slice(1,4).map(p=>p.owedTwd),[200,216,232]);assert.equal(c.transactions[0].twdAmount,648);
});
test('whole household expense does not invent individual shares',()=>{
 const c=L.calculate(people,groups,[row(648,'我',make('group',['g:family']))]);assert.equal(c.accounts[0].unallocatedTwd,648);assert(c.summary.every(p=>p.owedTwd===0));assert.equal(c.transactions[0].twdAmount,648);assert.equal(net(c),0);
});
test('whole-family and individual custom shares can coexist without double counting',()=>{
 const c=L.calculate(people,groups,[row(648,'我',make('amount',['g:family','p:別人'],{'g:family':500,'p:別人':148}))]);assert.equal(c.accounts[0].owedTwd,500);assert.equal(c.summary[4].owedTwd,148);assert.equal(net(c),0);
 assert.throws(()=>make('amount',['g:family','p:欣兒'],{'g:family':500,'p:欣兒':148}),/重複/);
});
test('old shared aggregate rounding is unchanged; settled and personal excluded',()=>{
 const c=L.calculate(['A','B','C'],[],[row(1,'A'),row(1,'A'),{...row(99,'C'),settled:true},{...row(20,'B'),personal:true}]);
 assert.deepEqual(c.summary.map(p=>p.owedTwd),[1,1,0]);assert.deepEqual(c.summary.map(p=>p.diffTwd),[1,-1,0]);assert.equal(c.summary[1].personalTwd,20);assert.equal(net(c),0);
});
test('foreign original shares scale to exact card bill with no TWD imbalance',()=>{
 const a=make('amount',['p:欣兒','p:家人甲','p:家人乙'],{'p:欣兒':1,'p:家人甲':1,'p:家人乙':1},3);
 const c=L.calculate(people,groups,[row(101,'我',a)]);assert.deepEqual(c.summary.slice(1,4).map(p=>p.owedTwd),[34,34,33]);assert.equal(c.transactions[0].twdAmount,101);assert.equal(net(c),0);
});
test('partial repayment reduces balance; repayments are not travel spending',()=>{
 const rows=[row(648,'我',make('group',['g:family']))];const p={id:'one',from:'欣兒',to:'我',amount:200};
 let c=L.calculate(people,groups,rows,[p]);assert.equal(c.transactions[0].twdAmount,448);assert.equal(c.total,648);assert.equal(net(c),0);
 c=L.calculate(people,groups,rows,[p,{id:'two',from:'欣兒',to:'我',amount:448}]);assert.equal(c.transactions.length,0);assert.equal(c.total,648);
});
test('reciprocal household advances net to a single payment',()=>{
 const rows=[row(648,'我',make('group',['g:family'])),row(100,'家人甲',make('equal',['p:我'],{},100))];
 const c=L.calculate(people,groups,rows);assert.equal(c.transactions[0].twdAmount,548);assert.equal(net(c),0);
});
test('removed/malformed subjects are flagged, never silently spread to everyone',()=>{
 const a=make('group',['g:family']);let c=L.calculate(people,[],[row(648,'我',a)]);assert.equal(c.unassignedCount,1);assert.equal(c.transactions.length,0);
 c=L.calculate(people,groups,[row(648,'不存在')]);assert.equal(c.unassignedCount,1);
 c=L.calculate(people,groups,[],[{from:'無',to:'我',amount:2}]);assert.equal(c.invalidPayments,1);
 assert.throws(()=>make('amount',['p:欣兒'],{'p:欣兒':647}),/合計/);assert.throws(()=>make('amount',['p:欣兒'],{'p:欣兒':-1}),/無效/);
});
test('person/family filters include beneficiaries, advances, and personal expenses correctly',()=>{
 const r=row(648,'我',make('equal',['p:欣兒','p:家人甲','p:家人乙']));
 assert(L.matches(r,people,groups,'欣兒'));assert(L.matches(r,people,groups,'我'));assert(!L.matches(r,people,groups,'別人'));assert(L.matches(r,people,groups,'','g:family'));
 assert(!L.matches({...row(648,'我'),personal:true},people,groups,'欣兒'));
});
test('group changes do not rewrite allocations or expense rows',()=>{
 const r=row(648,'我',make('equal',['p:欣兒','p:家人甲','p:家人乙'])),before=JSON.stringify(r);
 const c=L.calculate(people,[],[r]);assert.equal(c.transactions.length,3);assert.equal(JSON.stringify(r),before);assert.equal(net(c),0);
});
test('concurrent group/payment additions merge by stable IDs',()=>{
 const b=Sync.editable({});const l=Sync.clone(b),r=Sync.clone(b);l.settings.ledgerGroups.push(groups[0]);r.settings.ledgerGroups.push({id:'other',name:'另一組',members:['別人'],representative:'別人'});
 let result=Sync.merge(b,l,r);assert.equal(result.conflicts.length,0);assert.equal(result.value.settings.ledgerGroups.length,2);
 l.settings.ledgerPayments.push({id:'payment-a',amount:200});r.settings.ledgerPayments.push({id:'payment-b',amount:400});result=Sync.merge(b,l,r);assert.equal(result.conflicts.length,0);assert.equal(result.value.settings.ledgerPayments.length,2);
});
test('random distributions retain exactly all integer TWD',()=>{for(let n=1;n<10;n++)for(let total=0;total<300;total++){const values=L.distribute(total,Array.from({length:n},(_,i)=>i+1));assert(values.every(Number.isInteger));assert.equal(values.reduce((n,v)=>n+v,0),total);}});
test('empty trip produces no artificial debts',()=>{const c=L.calculate([],[],[]);assert.equal(c.transactions.length,0);assert.equal(c.summary.length,0);});
test('application script parses and phase grouping retains legacy entries',()=>{
 const html=fs.readFileSync(require('node:path').join(__dirname,'../葡猪.html'),'utf8');new vm.Script([...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1]);
 const phase=html.slice(html.indexOf('const ledgerPhase ='),html.indexOf('const expenseSections ='));
 const get=vm.runInNewContext(phase+'\nledgerPhase',{days:{value:[{fullDate:'2026-12-17'}]}});
 assert.equal(get({}),'before');assert.equal(get({createdDate:'2026-12-16'}),'before');assert.equal(get({createdDate:'2026-12-17'}),'during');assert.equal(get({expensePhase:'before',createdDate:'2026-12-20'}),'before');
});
