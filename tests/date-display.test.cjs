const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {formatDate,formatDateTime,component} = require('../assets/date-display.js');
for (const tz of ['Asia/Taipei','Asia/Seoul','America/Los_Angeles','Pacific/Honolulu']) {
    process.env.TZ=tz;
    assert.equal(formatDate('2026-12-17'),'2026/12/17');
    assert.equal(formatDate('2026-01-02'),'2026/01/02');
    assert.equal(formatDateTime('2026-12-17T09:05'),'2026/12/17 09:05');
    assert.equal(formatDate('2026-12-17T00:00:00Z'),'2026/12/17');
}
assert.equal(formatDate(''),''); assert.equal(formatDate(null),'');
assert.equal(formatDate('尚未確定'),'尚未確定');
assert.equal(formatDateTime('2026-12-17'),'2026/12/17');
const emitted=[];
component.methods.update.call({$emit:(...args)=>emitted.push(args)},{target:{value:'2026-12-20'}});
assert.deepEqual(emitted,[['update:modelValue','2026-12-20']]);
assert(component.template.includes(':disabled="disabled"'));
assert(component.template.includes(':value="modelValue"'));
assert(component.template.includes('@change="change"'));
const html=fs.readFileSync(path.join(__dirname,'../葡猪.html'),'utf8');
assert(html.includes("app.component('date-field', DateDisplay.component)"));
assert(!html.includes('type="date"')); // All visible full-date editors use the same presentation component.
assert(html.includes('label="航班日期"')); assert(html.includes('label="行程日期"'));
assert(html.includes('const formatFlightDate = formatDate;'));
assert(html.includes('const formatCredentialDate = DateDisplay.formatDateTime;'));
console.log('PASS fixed YYYY/MM/DD in all locales/timezones, unchanged ISO storage, native calendar, locked state and shared display across flights/plans/todos/vouchers/exports.');
