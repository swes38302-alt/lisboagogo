/* Pure accounting rules. All settlement amounts are integer TWD. */
(function (root) {
    const personKey = name => `p:${name}`;
    const groupKey = id => `g:${id}`;
    const integer = n => Number.isSafeInteger(n) && n >= 0;
    const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
    function context(members, groups = []) {
        const names = [...new Set(members)], used = new Set(), ids = new Set(), accepted = [];
        for (const group of groups) {
            if (!group || !group.id || ids.has(group.id) || !group.name || !Array.isArray(group.members) || !group.members.length || !group.members.includes(group.representative) || group.members.some(p => !names.includes(p) || used.has(p)) || new Set(group.members).size !== group.members.length) continue;
            accepted.push(group); ids.add(group.id); group.members.forEach(p => used.add(p));
        }
        const units = names.map(name => ({key:personKey(name), name, kind:'person', members:[name], representative:name}));
        accepted.forEach(g => units.push({key:groupKey(g.id), name:g.name, kind:'group', members:g.members, representative:g.representative}));
        const accounts = accepted.map(g => ({key:groupKey(g.id), name:g.name, representative:g.representative, members:g.members.slice()}));
        names.filter(p => !used.has(p)).forEach(p => accounts.push({key:personKey(p), name:p, representative:p, members:[p]}));
        return {names, units, accounts, invalidGroups:groups.length-accepted.length};
    }
    // Largest remainder, stable input order: no lost or duplicated settlement dollars.
    function distribute(total, weights) {
        if (!integer(total) || !weights.length || weights.some(w => !Number.isFinite(w) || w < 0)) throw Error('分攤金額無效');
        const sum = weights.reduce((n,w) => n+w,0);
        if (!(sum>0)) throw Error('請選擇分攤對象');
        const raw = weights.map(w => total*w/sum), values = raw.map(Math.floor);
        const order = raw.map((n,i) => ({i, fraction:n-values[i]})).sort((a,b) => b.fraction-a.fraction || a.i-b.i);
        let remaining = total-values.reduce((n,v) => n+v,0);
        for (let i=0; i<remaining; i++) values[order[i%order.length].i]++;
        return values;
    }
    function validateAllocation(allocation, ctx) {
        if (!allocation) return null;
        if (allocation.version!==1 || !['equal','amount','group'].includes(allocation.mode) || !Array.isArray(allocation.entries) || !allocation.entries.length) throw Error('請選擇分攤對象');
        const seen = new Set(), people = new Set();
        for (const entry of allocation.entries) {
            const unit = ctx.units.find(u => u.key===entry.key);
            if (!unit || seen.has(entry.key) || unit.members.some(p => people.has(p))) throw Error('分攤對象已變更或重複，請重新選擇');
            if (!Number.isFinite(entry.weight) || entry.weight<0) throw Error('分攤金額無效');
            seen.add(entry.key); unit.members.forEach(p => people.add(p));
        }
        if (!allocation.entries.some(e => e.weight>0)) throw Error('分攤金額須大於 0');
        return allocation;
    }
    function makeAllocation(mode, keys, amounts, originalAmount, members, groups) {
        if (!mode || mode==='all') return null; // Legacy all-member rounding is intentionally preserved.
        const ctx = context(members, groups);
        const entries = keys.map(key => ({key, weight:mode==='amount' ? Number(amounts[key]) : 1}));
        const allocation = {version:1,mode,entries};
        validateAllocation(allocation,ctx);
        if (mode==='group' && (entries.length!==1 || !entries[0].key.startsWith('g:'))) throw Error('請選擇一起結帳的群組');
        if (mode==='amount') {
            if (keys.some(key => amounts[key]==='' || amounts[key]===null || amounts[key]===undefined || !/^\d+(?:\.\d{1,2})?$/.test(String(amounts[key])))) throw Error('請填入各對象金額（最多兩位小數）');
            const cents = entries.reduce((n,e) => n+Math.round(e.weight*100),0);
            if (cents!==Math.round(originalAmount*100)) throw Error('各對象金額合計須等於這筆總金額');
        }
        return allocation;
    }
    function shares(row, ctx) {
        if (!row.allocation) return ctx.names.map((p,i) => ({key:personKey(p), twd:distribute(row.twd,ctx.names.map(()=>1))[i]}));
        validateAllocation(row.allocation,ctx);
        const values=distribute(row.twd,row.allocation.entries.map(e=>e.weight));
        return row.allocation.entries.map((e,i)=>({key:e.key,twd:values[i]}));
    }
    function calculate(members, groups, rows, payments=[]) {
        const ctx=context(members,groups), paid=Object.create(null), owed=Object.create(null), personal=Object.create(null), bulk=Object.create(null);
        ctx.names.forEach(p=>{paid[p]=0;owed[p]=0;personal[p]=0});
        ctx.accounts.forEach(a=>bulk[a.key]=0);
        let unassignedCount=0, legacyTotal=0, total=0, invalidPayments=0;
        const validRows=[];
        for (const row of rows) {
            if (!integer(row.twd)) {unassignedCount++;continue;}
            if (row.personal) {if(own(personal,row.payer))personal[row.payer]+=row.twd;continue;}
            if (row.settled) continue;
            if (!own(paid,row.payer) || !ctx.names.length) {unassignedCount++;continue;}
            try {if(row.allocation)validateAllocation(row.allocation,ctx);} catch {unassignedCount++;continue;}
            paid[row.payer]+=row.twd;total+=row.twd;validRows.push(row);
            if (!row.allocation) {legacyTotal+=row.twd;continue;}
            shares(row,ctx).forEach(s=>{if(s.key.startsWith('p:'))owed[s.key.slice(2)]+=s.twd;else bulk[s.key]+=s.twd;});
        }
        if(ctx.names.length)distribute(legacyTotal,ctx.names.map(()=>1)).forEach((n,i)=>owed[ctx.names[i]]+=n);
        const summary=ctx.names.map(name=>({name,paidTwd:paid[name],owedTwd:owed[name],personalTwd:personal[name],diffTwd:paid[name]-owed[name]}));
        const accounts=ctx.accounts.map(a=>({...a,paidTwd:a.members.reduce((n,p)=>n+paid[p],0),owedTwd:a.members.reduce((n,p)=>n+owed[p],0)+bulk[a.key],unallocatedTwd:bulk[a.key],paymentsTwd:0}));
        const accountFor=p=>accounts.find(a=>a.members.includes(p));
        for(const payment of payments){
            const from=accountFor(payment.from),to=accountFor(payment.to);
            if(!from||!to||payment.from===payment.to||!integer(payment.amount)||payment.amount===0){invalidPayments++;continue;}
            from.paymentsTwd+=payment.amount;to.paymentsTwd-=payment.amount;
        }
        const balances=Object.create(null);
        accounts.forEach(a=>{a.diffTwd=a.paidTwd-a.owedTwd+a.paymentsTwd;balances[a.key]=a.diffTwd;});
        const creditors=accounts.filter(a=>a.diffTwd>0).map(a=>({...a,remaining:a.diffTwd})).sort((a,b)=>b.remaining-a.remaining);
        const debtors=accounts.filter(a=>a.diffTwd<0).map(a=>({...a,remaining:-a.diffTwd})).sort((a,b)=>b.remaining-a.remaining);
        const transactions=[];let i=0,j=0;
        while(i<creditors.length&&j<debtors.length){
            const c=creditors[i],d=debtors[j],amount=Math.min(c.remaining,d.remaining);
            transactions.push({from:d.representative,to:c.representative,fromKey:d.key,toKey:c.key,fromName:d.name,toName:c.name,twdAmount:amount});
            c.remaining-=amount;d.remaining-=amount;if(c.remaining===0)i++;if(d.remaining===0)j++;
        }
        return {averageTwd:ctx.names.length?Math.round(total/ctx.names.length):0,total,summary,accounts,balances,transactions,unassignedCount,invalidPayments,invalidGroups:ctx.invalidGroups,validRows};
    }
    function matches(row, members, groups, person='', accountKey='') {
        const ctx=context(members,groups),account=ctx.accounts.find(a=>a.key===accountKey);
        const targets=person?[person]:account?account.members:[];
        if(!targets.length)return !accountKey;
        if(targets.includes(row.payer))return true;
        if(row.personal)return false;
        if(!row.allocation)return true;
        return row.allocation.entries?.some(e=>{const unit=ctx.units.find(u=>u.key===e.key);return unit&&unit.members.some(p=>targets.includes(p));})||false;
    }
    root.FamilyLedger={personKey,groupKey,context,distribute,makeAllocation,shares,calculate,matches};
    if(typeof module!=='undefined'&&module.exports)module.exports=root.FamilyLedger;
})(globalThis);
