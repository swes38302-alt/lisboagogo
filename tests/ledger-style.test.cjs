const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../葡猪.html'),'utf8'),css=fs.readFileSync(path.join(__dirname,'../assets/family-ledger.css'),'utf8');
test('money overview restores original-currency and exact TWD totals together',()=>{
 const overview=html.slice(html.indexOf('<div class="ledger-total mb-4">'),html.indexOf('<div class="ledger-tabs"'));
 assert(overview.includes('{{ settings.currency }}'));assert(overview.includes('totalExpense.toLocaleString'));assert(overview.includes('NT$ {{ totalExpenseTwd.toLocaleString() }}'));assert(overview.includes('estimatedTwdCount'));
 assert(css.includes('.ledger-total{background:#1e293b;color:#fff;'));assert(css.includes('.ledger-total-twd{color:#67e8f9;'));
});
test('expense form has compact split switches, no manual before/during classification dropdown',()=>{
 const form=html.slice(html.indexOf('<div v-if="showExpenseForm" id="expense-form"'),html.indexOf('<div id="ledger-person-filters"'));
 assert(!form.includes('費用分類'));assert(!form.includes('v-model="newExpense.expensePhase"'));assert(form.includes('aria-label="分攤方式"'));assert(form.includes('setLedgerAllocationMode(mode.key)'));assert(css.includes('border-radius:999px'));
});
test('single beneficiary is inline with payer and shared badge, not a separate footer',()=>{
 const match=html.match(/<div class="expense-card-meta">([\s\S]*?)<\/div>/);assert(match);assert(match[1].includes('class="ledger-expense-single"'));assert(match[1].includes('ledgerAllocationLabel(exp)'));assert(!html.includes('<div v-else-if="exp.splitType'));assert(!css.includes('.ledger-expense-single{margin-top:'));
});
test('all, family and person filters share one compact strip without removing settlement controls',()=>{
 const strip=html.slice(html.indexOf('<div id="ledger-person-filters"'),html.indexOf('<div class="space-y-3 pb-10">'));
 assert(strip.includes('ledger-filter-strip'));assert(strip.includes('ledgerSelectedAccount=account.key'));assert(strip.includes('ledgerSelectedPerson===p'));assert(strip.includes('>全部</button>'));
 assert(css.includes('overflow-x:auto'));assert(html.includes('@click="saveLedgerGroup"'));assert(html.includes('@click="saveRepayment"'));
});
