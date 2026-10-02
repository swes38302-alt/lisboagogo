/* Three-way merging for shared trips. No network or UI side effects. */
(function (root) {
    const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
    const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
    const equal = (a, b) => {
        if (a === b) return true;
        if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => equal(v, b[i]));
        if (!object(a) || !object(b)) return false;
        const keys = Object.keys(a);
        return keys.length === Object.keys(b).length && keys.every(key => Object.prototype.hasOwnProperty.call(b, key) && equal(a[key], b[key]));
    };
    const editable = trip => ({
        days: (trip.days || []).map(day => ({ ...clone(day), items: (Array.isArray(day.items) ? day.items : []).map(item => ({ ...clone(item), error: item.error || false })) })).sort((a, b) => String(a.fullDate || '').localeCompare(String(b.fullDate || ''))),
        expenses: clone(trip.expenses || []),
        settings: { name: '新旅程', location: '', currency: '€', rate: 34.5, isLocked: false, password: '', themeColor: '', ...clone(trip.settings || {}) },
        participants: clone(trip.participants || []), todos: clone(trip.todos || []),
        flights: trip.flights ? clone(Object.values(trip.flights)) : []
    });
    const merge = (base, local, remote) => {
        const conflicts = [];
        const visit = (before, ours, theirs, path) => {
            if (equal(ours, before)) return clone(theirs);
            if (equal(theirs, before) || equal(ours, theirs)) return clone(ours);
            if (object(before) && object(ours) && object(theirs)) {
                const result = {};
                for (const key of new Set([...Object.keys(before), ...Object.keys(ours), ...Object.keys(theirs)])) {
                    const value = visit(before[key], ours[key], theirs[key], `${path}/${key}`);
                    if (value !== undefined) result[key] = value;
                }
                return result;
            }
            if (Array.isArray(before) && Array.isArray(ours) && Array.isArray(theirs)) {
                const values = [...before, ...ours, ...theirs];
                const key = ['id', 'fullDate'].find(k => values.length && values.every(v => object(v) && v[k] !== undefined) && [before, ours, theirs].every(a => new Set(a.map(v => String(v[k]))).size === a.length));
                if (key) {
                    const index = array => new Map(array.map(v => [String(v[key]), v]));
                    const b = index(before), l = index(ours), r = index(theirs), merged = new Map();
                    for (const id of new Set([...b.keys(), ...l.keys(), ...r.keys()])) {
                        const value = visit(b.get(id), l.get(id), r.get(id), `${path}/${id}`);
                        if (value !== undefined) merged.set(id, value);
                    }
                    const common = [...b.keys()].filter(id => l.has(id) && r.has(id) && merged.has(id));
                    const order = map => [...map.keys()].filter(id => common.includes(id));
                    const bo = order(b), lo = order(l), ro = order(r);
                    if (!equal(lo, bo) && !equal(ro, bo) && !equal(lo, ro)) conflicts.push(`${path}/order`);
                    const primary = equal(lo, bo) ? r : l;
                    const secondary = primary === r ? l : r;
                    const ids = [...primary.keys()].filter(id => merged.has(id));
                    const other = [...secondary.keys()].filter(id => merged.has(id));
                    for (let i = 0; i < other.length; i++) {
                        const id = other[i];
                        if (ids.includes(id)) continue;
                        const next = other.slice(i + 1).find(candidate => ids.includes(candidate));
                        if (next) ids.splice(ids.indexOf(next), 0, id); else ids.push(id);
                    }
                    return ids.map(id => merged.get(id));
                }
            }
            conflicts.push(path || '/');
            return clone(ours);
        };
        const value = visit(base, local, remote, '');
        return { value, conflicts };
    };
    root.TripSync = { clone, equal, editable, merge };
    if (typeof module !== 'undefined' && module.exports) module.exports = root.TripSync;
})(globalThis);
