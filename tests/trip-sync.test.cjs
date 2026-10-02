const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Sync = require('../assets/trip-sync.js');
const html = fs.readFileSync(require('node:path').join(__dirname, '../葡猪.html'), 'utf8');
const appCode = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
new vm.Script(appCode);
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`PASS ${name}`); };
const base = { days: [{ fullDate: '2026-10-30', title: '鳥羽', items: [{ id: 1, activity: '水族館', time: '09:30', note: '' }, { id: 2, activity: '午餐', time: '12:15', note: '' }] }], settings: { rate: .21 }, expenses: [], participants: [] };
const copy = Sync.clone;
test('No edits preserves remote update', () => { const remote = copy(base); remote.days[0].items[0].time = '10:00'; assert.deepEqual(Sync.merge(base, base, remote), { value: remote, conflicts: [] }); });
test('Independent card edits merge', () => { const local = copy(base), remote = copy(base); local.days[0].items[0].note = '海獺'; remote.days[0].items[1].time = '12:45'; const m = Sync.merge(base, local, remote); assert.equal(m.conflicts.length, 0); assert.equal(m.value.days[0].items[0].note, '海獺'); assert.equal(m.value.days[0].items[1].time, '12:45'); });
test('Same card different fields merge', () => { const local = copy(base), remote = copy(base); local.days[0].items[0].note = '海獺'; remote.days[0].items[0].time = '10:00'; assert.equal(Sync.merge(base, local, remote).conflicts.length, 0); });
test('Same field conflict retains local without authorizing overwrite', () => { const local = copy(base), remote = copy(base); local.days[0].items[0].time = '10:00'; remote.days[0].items[0].time = '11:00'; const m = Sync.merge(base, local, remote); assert.equal(m.value.days[0].items[0].time, '10:00'); assert.equal(m.conflicts.length, 1); });
test('Remote reorder does not assign edits to wrong card', () => { const local = copy(base), remote = copy(base); local.days[0].items[0].note = '保留'; remote.days[0].items.reverse(); const m = Sync.merge(base, local, remote); assert.equal(m.conflicts.length, 0); assert.equal(m.value.days[0].items[0].id, 2); assert.equal(m.value.days[0].items[1].note, '保留'); });
test('Two independent new cards survive', () => { const local = copy(base), remote = copy(base); local.days[0].items.splice(1, 0, { id: 3 }); remote.days[0].items.push({ id: 4 }); const m = Sync.merge(base, local, remote); assert.equal(m.conflicts.length, 0); assert.deepEqual(new Set(m.value.days[0].items.map(i => i.id)), new Set([1,2,3,4])); });
test('Deletion survives unrelated edit', () => { const local = copy(base), remote = copy(base); local.days[0].items.pop(); remote.days[0].items[0].note = '新'; const m = Sync.merge(base, local, remote); assert.equal(m.conflicts.length, 0); assert.equal(m.value.days[0].items.length, 1); });
test('Delete versus edit conflicts', () => { const local = copy(base), remote = copy(base); local.days[0].items.pop(); remote.days[0].items[1].note = '新'; assert.equal(Sync.merge(base, local, remote).conflicts.length, 1); });
test('Concurrent legacy expense edits refuse ambiguous merge', () => { const b = { expenses: [{ item:'A',amount:1 },{item:'B',amount:2}] }, l=copy(b), r=copy(b); l.expenses[0].amount=3; r.expenses[1].amount=4; assert.equal(Sync.merge(b,l,r).conflicts.length, 1); });
test('Normalization respects saved exchange rate and extra fields', () => { const t = copy(base); t.settings.rate = .234; t.settings.custom = 'kept'; const e=Sync.editable(t); assert.equal(e.settings.rate,.234); assert.equal(e.settings.custom,'kept'); });
test('Property order does not create false conflicts', () => assert(Sync.equal({a:1,b:2},{b:2,a:1})));
test('Null and deletion remain distinct', () => { const m=Sync.merge({a:1},{a:null},{a:1}); assert.deepEqual(m.value,{a:null}); });


console.log(`${passed} merge tests passed; app script syntax checked.`);
