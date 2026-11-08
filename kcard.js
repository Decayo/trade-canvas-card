/*! kcard — trade-canvas T3 card shell. Built from 20 modules: public/core/time.js, public/core/options.js, public/core/layers.js, public/core/theme.js, public/core/vp.js, public/core/drawings.js, public/core/chart.js, public/core/wire.js, indicators/gap.js, indicators/_util.js, indicators/vol.js, indicators/vrvp.js, indicators/ma.js, indicators/vwap.js, indicators/boll.js, indicators/macd.js, indicators/kdj.js, indicators/gmma.js, card/indicators.js, card/shell.js */
(function () {
window.__kcardScript = document.currentScript;
var __M = {};
__M['public/core/time.js'] = (() => {
const TZ = 'America/New_York';
const PERIODS = {
M1: { label: '1分', type: 'minute', span: 1, min: 1, lookbackDays: 5, warmDays: 6 },
M5: { label: '5分', type: 'minute', span: 5, min: 5, lookbackDays: 14, warmDays: 25 },
M15: { label: '15分', type: 'minute', span: 15, min: 15, lookbackDays: 30, warmDays: 60 },
M30: { label: '30分', type: 'minute', span: 30, min: 30, lookbackDays: 45, warmDays: 160 },
H1: { label: '1時', type: 'hour', span: 1, min: 60, lookbackDays: 90, warmDays: 330 },
H4: { label: '4時', type: 'hour', span: 4, min: 240, lookbackDays: 250, warmDays: 900 },
D1: { label: '日', type: 'day', span: 1, min: 1440, lookbackDays: 400, warmDays: 1400 },
W1: { label: '週', type: 'week', span: 1, min: 10080, lookbackDays: 1100, warmDays: 2600 },
MN1: { label: '月', type: 'month', span: 1, min: 43200, months: 1, lookbackDays: 3650, warmDays: 7300 },
Q1: { label: '季', type: 'month', span: 3, min: 129600, months: 3, lookbackDays: 7300, warmDays: 3650 },
};
const RTH_MIN = { M1: 1, M5: 5, M15: 15, M30: 30, H1: 60, H4: 195, D1: 390, W1: 1950, MN1: 8190, Q1: 24570 };
const fmt = new Intl.DateTimeFormat('en-US', {
timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
hour: '2-digit', minute: '2-digit', weekday: 'short',
});
function etParts(ms) {
const p = {};
for (const { type, value } of fmt.formatToParts(new Date(ms))) p[type] = value;
const hh = Number(p.hour) % 24;
const mm = Number(p.minute);
return {
y: Number(p.year), m: Number(p.month), d: Number(p.day), hh, mm, weekday: p.weekday,
dateKey: `${p.year}-${p.month}-${p.day}`,
hhmm: `${String(hh).padStart(2, '0')}:${p.minute}`,
minutes: hh * 60 + mm,
};
}
function etWallToUtc(y, m, d, hh = 0, mm = 0) {
let guess = Date.UTC(y, m - 1, d, hh + 5, mm);
for (let i = 0; i < 2; i++) {
const p = etParts(guess);
const diff = Date.UTC(y, m - 1, d, hh, mm) - Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm);
guess += diff;
}
return guess;
}
function toChartBars(raw, tf) {
const p = PERIODS[tf];
return raw.map((b) => {
const closeMs = Math.round(Number(b.ts_event) / 1e6);
let start;
if (p.months) { // close is the first day of the next period, 00:00 UTC
const d = new Date(closeMs); d.setUTCMonth(d.getUTCMonth() - p.months);
start = d.getTime() + 13.5 * 36e5;
} else if (p.min >= 1440) start = closeMs - p.min * 6e4 + 13.5 * 36e5; // day / week: key on 09:30 ET of the first day
else start = closeMs - p.min * 6e4;
return {
timestamp: start, close_ts: closeMs,
open: Number(b.open), high: Number(b.high), low: Number(b.low), close: Number(b.close),
volume: Number(b.volume),
};
});
}
function barIndexAt(list, ts) {
let lo = 0, hi = list.length - 1, ans = -1;
while (lo <= hi) {
const mid = (lo + hi) >> 1;
if (list[mid].timestamp <= ts) { ans = mid; lo = mid + 1; } else hi = mid - 1;
}
return ans;
}
const RTH_OPEN = 9 * 60 + 30;
const RTH_CLOSE = 16 * 60;
function barNumbers(list, tf) {
const p = PERIODS[tf];
if (!p || p.min >= 1440) return list.map(() => null);
let day = null, seq = 0;
return list.map((b) => {
const e = etParts(b.timestamp);
if (e.minutes < RTH_OPEN || e.minutes >= RTH_CLOSE) return null;
if (e.dateKey !== day) { day = e.dateKey; seq = 0; }
seq += 1;
const n = p.min <= 30 ? Math.floor((e.minutes - RTH_OPEN) / p.min) + 1 : seq;
return { n, start: e.hhmm, date: e.dateKey };
});
}
return { TZ, PERIODS, RTH_MIN, etParts, etWallToUtc, toChartBars, barIndexAt, barNumbers };
})();
__M['public/core/options.js'] = (() => {
const { etWallToUtc } = __M['public/core/time.js'];
const RATE = 0.04;
const OCC = /^([A-Z. ]{6})(\d{2})(\d{2})(\d{2})([CP])(\d{8})\.SMART$/;
function parseOption(symbol) {
const m = OCC.exec(symbol || '');
if (!m) return null;
const [, root, yy, mm, dd, right, k] = m;
return {
root: root.trim(), right, strike: Number(k) / 1000,
expiry: `20${yy}-${mm}-${dd}`,
expiryMs: etWallToUtc(2000 + Number(yy), Number(mm), Number(dd), 16, 0),
};
}
function optionSymbol(root, expiry, right, strike) {
const [y, m, d] = expiry.split('-');
return `${root.padEnd(6)}${y.slice(2)}${m}${d}${right}${String(Math.round(strike * 1000)).padStart(8, '0')}.SMART`;
}
function shortName(symbol) {
const o = parseOption(symbol);
if (!o) return symbol;
return `${o.root} ${o.expiry.slice(5).replace('-', '')} ${o.strike}${o.right}`;
}
function ncdf(x) {
const t = 1 / (1 + 0.2316419 * Math.abs(x));
const d = 0.3989422804014327 * Math.exp(-x * x / 2);
const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
return x >= 0 ? 1 - p : p;
}
function yearsTo(expiryMs, nowMs = Date.now()) {
return Math.max((expiryMs - nowMs) / (365 * 864e5), 1e-6);
}
function blackScholes({ S, K, T, sigma, right, r = RATE }) {
if (!(S > 0 && K > 0 && sigma > 0)) return null;
const st = sigma * Math.sqrt(T);
const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / st;
const d2 = d1 - st;
if (right === 'C') return S * ncdf(d1) - K * Math.exp(-r * T) * ncdf(d2);
return K * Math.exp(-r * T) * ncdf(-d2) - S * ncdf(-d1);
}
function pnl(qty, entry, price) {
if (!(price >= 0) || !(entry > 0)) return null;
return { usd: qty * 100 * (price - entry), pct: (price - entry) / entry };
}
function fmtPnl(p) {
if (!p) return '—';
const s = (v) => (v >= 0 ? '+' : '') + Math.round(v);
return `${s(p.usd)}(${Math.round(p.pct * 100)}%)`;
}
function orderView(order, quote, linePrice, nowMs = Date.now(), spot = null) {
const o = parseOption(order.option);
let q = quote || {};
if (spot != null && o && (order.sim_clock === 'replay' || q.est) && q.mark_iv > 0) {
const m = blackScholes({ S: spot, K: o.strike, T: yearsTo(o.expiryMs, nowMs), sigma: q.mark_iv, right: o.right });
if (m != null) q = { ...q, last: m, bid: m, est: true };
}
const byLast = pnl(order.qty, order.entry, q.last);
const byBid = pnl(order.qty, order.entry, q.bid);
let predicted = null;
if (o && q.mark_iv > 0) {
predicted = blackScholes({ S: linePrice, K: o.strike, T: yearsTo(o.expiryMs, nowMs), sigma: q.mark_iv, right: o.right });
}
const predPnl = predicted == null ? null : pnl(order.qty, order.entry, predicted);
return {
name: shortName(order.option), qty: order.qty, entry: order.entry, linePrice,
byLast, byBid, predicted, predPnl, sample: !!q.sample, est: !!q.est, unlisted: !!q.unlisted, iv: q.mark_iv ?? null,
now: `${fmtPnl(byLast)} / ${fmtPnl(byBid)}`,
};
}
const ORDER_STATUS = {
PendingSubmit: { color: '#7ec8ff', text: '#0b1d2b', label: 'PendingSubmit' },   // light blue
ApiPending: { color: '#7ec8ff', text: '#0b1d2b', label: 'ApiPending' },
PreSubmitted: { color: '#1e4fa3', text: '#ffffff', label: 'PreSubmitted' },     // dark blue
Submitted: { color: '#26a69a', text: '#ffffff', label: 'Submitted' },           // green, working
PendingCancel: { color: '#f48fb1', text: '#2b0b18', label: 'PendingCancel' },   // pink
Cancelled: { color: '#ef5350', text: '#ffffff', label: 'Cancelled' },           // red
ApiCancelled: { color: '#ef5350', text: '#ffffff', label: 'ApiCancelled' },
Rejected: { color: '#ef5350', text: '#ffffff', label: 'Rejected', urgent: true },
Filled: { color: '#787b86', text: '#ffffff', label: 'Filled' },                 // grey
Closed: { color: '#4b5263', text: '#ffffff', label: 'Closed' },                 // p1.46: sim close (app state, not TWS)
UNKNOWN: { color: '#ef5350', text: '#ffffff', label: 'UNKNOWN', urgent: true },
};
function planTable(plan, ivOf, nowMs = Date.now()) {
return (plan.candidates || []).map((cd) => {
const o = parseOption(cd.symbol);
const iv = ivOf(cd.symbol);
const T = o ? yearsTo(o.expiryMs, nowMs) : null;
const prem = (S, t = T) => (o && iv > 0 && S != null ? blackScholes({ S, K: o.strike, T: t, sigma: iv, right: o.right }) : null);
const theta = o && iv > 0 && plan.linePrice != null && T > 1 / 365 ? prem(plan.linePrice, T - 1 / 365) - prem(plan.linePrice) : null;
const dte = o ? Math.max(0, Math.round((o.expiryMs - nowMs) / 864e5)) : null;
const pe = prem(plan.linePrice), pt = prem(plan.tp), ps = prem(plan.sl);
const qty = cd.qty || 1;
const pnl = (p) => (p != null && pe != null ? qty * 100 * (p - pe) : null);
const pnlTp = pnl(pt), pnlSl = pnl(ps);
return {
symbol: cd.symbol, name: shortName(cd.symbol), qty, chosen: !!cd.chosen, iv, dte, expiry: o?.expiry, strike: o?.strike, right: o?.right,
theta_day: theta != null ? qty * 100 * theta : null,
entry: pe, at_tp: pt, at_sl: ps, pnl_tp: pnlTp, pnl_sl: pnlSl,
rr: pnlTp != null && pnlSl != null && pnlSl < 0 ? pnlTp / -pnlSl : null,
cost: pe != null ? qty * 100 * pe : null,
};
});
}
const rightOf = (o) => (o?.kind === 'plan' ? (o.right === 'P' ? 'P' : 'C') : parseOption(o?.option)?.right || 'C');
const dirOf = (right) => (right === 'P' ? -1 : 1);
const r2 = (v) => Math.round(v * 100) / 100;
const mirror = (entry, x) => (x == null ? null : r2(2 * entry - x));
function withRight(symbol, right) {
const o = parseOption(symbol);
return o ? optionSymbol(o.root, o.expiry, right, o.strike) : symbol;
}
function legSideOk(right, entry, leg, price) {
if (price == null || entry == null || leg === 'entry') return true;
const d = dirOf(right) * (price - entry);
return leg === 'tp' ? d > 0 : d < 0;
}
function bracketOk(right, lv) {
return legSideOk(right, lv.linePrice, 'tp', lv.tp) && legSideOk(right, lv.linePrice, 'sl', lv.sl);
}
function planUnderlying(plan) {
const e = plan.linePrice, dir = dirOf(rightOf({ ...plan, kind: 'plan' }));
const mv = (x) => (x == null ? null : { pts: x - e, pct: ((x - e) / e) * 100, gain: dir * (x - e) });
const reward = plan.tp != null ? dir * (plan.tp - e) : null, risk = plan.sl != null ? dir * (e - plan.sl) : null;
const rr = reward != null && risk != null && reward > 0 && risk > 0 ? reward / risk : null;
return { tp: mv(plan.tp), sl: mv(plan.sl), rr };
}
const DTE_LADDER = [7, 14, 30];
function nearestExpiry(fromMs = Date.now(), days = 14) {
const t = new Date(fromMs + days * 864e5);
while ([0, 6].includes(t.getUTCDay())) t.setUTCDate(t.getUTCDate() + 1);
return t.toISOString().slice(0, 10);
}
function dteLadder(fromMs = Date.now(), days = DTE_LADDER) {
const out = [];
for (const d of days) {
const key = nearestExpiry(fromMs, d);
if (!out.includes(key)) out.push(key);
}
return out;
}
return { RATE, parseOption, optionSymbol, shortName, yearsTo, blackScholes, pnl, fmtPnl, orderView, ORDER_STATUS, planTable, rightOf, dirOf, mirror, withRight, legSideOk, bracketOk, planUnderlying, DTE_LADDER, nearestExpiry, dteLadder };
})();
__M['public/core/layers.js'] = (() => {
function leaves(state, metas) {
const out = [];
for (const m of metas) out.push({ path: `indicators/${m.name}`, kind: 'indicator', ref: m.name, label: m.label });
out.push({ path: 'system/bar-number', kind: 'barno', label: 'bar 編號' });
for (const c of state.intakeCleaners || []) out.push({ path: `system/intake/${c.name}`, kind: 'intake', label: c.label });
for (const n of state.notes || []) out.push({ path: n.path, kind: 'note', ref: n.id, label: n.text });
for (const o of state.orders || []) {
const base = tradePath(state, o);
const kind = o.kind === 'plan' ? 'plan' : 'order';
out.push({ path: `${base}/entry`, kind, ref: o.id, group: groupOf(o), leg: 'entry', label: 'entry' });
if (o.tp != null) out.push({ path: `${base}/tp`, kind, ref: o.id, group: groupOf(o), leg: 'tp', label: 'take-profit' });
if (o.sl != null) out.push({ path: `${base}/sl`, kind, ref: o.id, group: groupOf(o), leg: 'sl', label: 'stop-loss' });
}
for (const f of state.fills || []) out.push({ path: f.path, kind: 'fill', ref: f.id, label: f.text });
for (const s of state.signals || []) out.push({ path: s.path, kind: 'signal', ref: s.id, label: s.name });
for (const d of state.drawings || []) if (d.path) out.push({ path: d.path, kind: 'drawing', ref: d.id, label: d.label || d.kind });
return out;
}
function nodePaths(ls) {
const set = new Set();
for (const l of ls) {
const segs = l.path.split('/');
for (let i = 1; i <= segs.length; i++) set.add(segs.slice(0, i).join('/'));
}
return [...set];
}
function tree(ls) {
const root = { name: '', path: '', children: new Map(), leaf: null };
for (const l of ls) {
let node = root;
const segs = l.path.split('/');
segs.forEach((seg, i) => {
if (!node.children.has(seg)) node.children.set(seg, { name: seg, path: segs.slice(0, i + 1).join('/'), children: new Map(), leaf: null });
node = node.children.get(seg);
});
node.leaf = l;
}
return root;
}
function shown(path, off = {}) {
const segs = path.split('/');
for (let i = 1; i <= segs.length; i++) if (off[segs.slice(0, i).join('/')]) return false;
return true;
}
function globRe(glob) {
const body = glob.split('/').map((seg) => (seg === '**' ? '\u0000' : seg.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*'))).join('/');
const re = body.replace(/\u0000\//g, '(?:[^/]+/)*').replace(/\/\u0000/g, '(?:/[^/]+)*').replace(/\u0000/g, '.*');
return new RegExp(`^${re}$`);
}
function matcher(text) {
const t = (text || '').trim();
if (!t) return () => true;
if (t.includes('*')) { const re = globRe(t); return (p) => re.test(p); }
const low = t.toLowerCase();
return (p) => p.toLowerCase().includes(low);
}
function applyFilter(filter, patch, paths) {
const off = { ...(filter?.off || {}) };
const touched = [];
const setOn = (p, on) => { touched.push(p); if (on) delete off[p]; else off[p] = true; };
for (const g of patch.hide || []) { const re = globRe(g); for (const p of paths) if (re.test(p)) setOn(p, false); }
for (const g of patch.show || []) { const re = globRe(g); for (const p of paths) if (re.test(p)) setOn(p, true); }
for (const [p, on] of Object.entries(patch.set || {})) setOn(p, !!on);
return { filter: { off }, touched };
}
function visibleSet(state, metas, filter) {
return new Set(leaves(state, metas).filter((l) => shown(l.path, filter?.off)).map((l) => l.path));
}
function slug(text) {
return String(text).replace(/\//g, '∕').trim().slice(0, 40) || 'item';
}
function groupOf(o) { return o.from_plan || o.id; }
function groupName(state, gid) {
const g = (state.orders || []).find((x) => x.id === gid);
return slug(g ? (g.kind === 'plan' ? g.label : g.label) : gid);
}
function tradePath(state, o) {
const gid = groupOf(o);
const member = o.kind === 'plan' ? 'plan' : (o.from_plan ? `order ${slug(o.label)} #${o.id}` : 'order');
return `trade/${groupName(state, gid)}/${member}`;
}
function groupPath(state, gid) { return `trade/${groupName(state, gid)}`; }
return { leaves, nodePaths, tree, shown, globRe, matcher, applyFilter, visibleSet, slug, groupOf, tradePath, groupPath };
})();
__M['public/core/theme.js'] = (() => {
const T = {
bg: '#131722', panel: '#1e222d', border: '#2a2e39', grid: '#1f2430', text: '#d1d4dc', muted: '#787b86',
up: '#26a69a', down: '#ef5350', accent: '#2962ff', human: '#2962ff', agent: '#ab47bc',
noteRow: 'rgba(30,34,45,0.92)', badgeText: '#ffffff',
};
function chartStyles() {
const axis = { axisLine: { color: T.border }, tickLine: { color: T.border }, tickText: { color: T.muted } };
const crossText = { borderColor: '#363a45', backgroundColor: '#363a45', color: T.text };
return {
grid: { horizontal: { color: T.grid }, vertical: { color: T.grid } },
candle: {
bar: { upColor: T.up, downColor: T.down, noChangeColor: T.muted, upBorderColor: T.up, downBorderColor: T.down,
noChangeBorderColor: T.muted, upWickColor: T.up, downWickColor: T.down, noChangeWickColor: T.muted },
priceMark: { high: { color: T.muted }, low: { color: T.muted }, last: { upColor: T.up, downColor: T.down } },
tooltip: { title: { color: T.text }, legend: { color: T.muted } },
},
indicator: { tooltip: { title: { color: T.muted }, legend: { color: T.muted } } },
xAxis: axis, yAxis: axis,
separator: { color: T.border, activeBackgroundColor: 'rgba(41,98,255,0.15)' },
crosshair: {
horizontal: { line: { color: '#5d606b' }, text: crossText },
vertical: { line: { color: '#5d606b' }, text: crossText },
},
};
}
return { T, chartStyles };
})();
__M['public/core/vp.js'] = (() => {
const { RTH_MIN } = __M['public/core/time.js'];
const VP_TFS = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1'];
const VP_DEFAULTS = { rows: 800, va: 70, mode: 'updown', width: 25, eth: false };
function pickLowerTf(chartTf, visibleBars) {
const minutes = visibleBars * (RTH_MIN[chartTf] || 390);
return VP_TFS.find((tf) => minutes / RTH_MIN[tf] < 5000) || 'D1';
}
function spread(upArr, dnArr, b, lo, step, nb, sign = 1) {
const arr = b.close >= b.open ? upArr : dnArr;
const v = (b.volume || 0) * sign;
if (!v) return;
if (b.high <= b.low) {
const k = Math.min(nb - 1, Math.max(0, Math.floor((b.low - lo) / step)));
arr[k] += v;
return;
}
const span = b.high - b.low;
const k0 = Math.max(0, Math.floor((b.low - lo) / step));
const k1 = Math.min(nb - 1, Math.floor((b.high - lo) / step));
for (let k = k0; k <= k1; k++) {
const a = Math.max(b.low, lo + k * step), z = Math.min(b.high, lo + (k + 1) * step);
if (z > a) arr[k] += (v * (z - a)) / span;
}
}
function buildIndex(bars, { bins = 3000, block = 64 } = {}) {
let lo = Infinity, hi = -Infinity;
for (const b of bars) { if (b.low < lo) lo = b.low; if (b.high > hi) hi = b.high; }
if (!bars.length || !(hi > lo)) return null;
const pad = (hi - lo) * 1e-6;
lo -= pad; hi += pad;
const step = (hi - lo) / bins;
const nBlocks = Math.floor(bars.length / block);
const preUp = [new Float64Array(bins)], preDn = [new Float64Array(bins)];
const up = new Float64Array(bins), dn = new Float64Array(bins);
for (let j = 0; j < nBlocks; j++) {
for (let i = j * block; i < (j + 1) * block; i++) spread(up, dn, bars[i], lo, step, bins);
preUp.push(Float64Array.from(up)); preDn.push(Float64Array.from(dn));
}
return { bars, lo, step, bins, block, preUp, preDn };
}
function indexRange(bars, t0, t1) {
const find = (t) => { let a = 0, z = bars.length; while (a < z) { const m = (a + z) >> 1; if (bars[m].timestamp < t) a = m + 1; else z = m; } return a; };
return [find(t0), find(t1)];
}
function windowBins(ix, i0, i1) {
const { bars, lo, step, bins, block, preUp, preDn } = ix;
const up = new Float64Array(bins), dn = new Float64Array(bins);
const b0 = Math.ceil(i0 / block), b1 = Math.floor(i1 / block);
if (b0 < b1 && b1 < preUp.length) {
for (let k = 0; k < bins; k++) { up[k] = preUp[b1][k] - preUp[b0][k]; dn[k] = preDn[b1][k] - preDn[b0][k]; }
for (let i = i0; i < b0 * block; i++) spread(up, dn, bars[i], lo, step, bins);
for (let i = b1 * block; i < i1; i++) spread(up, dn, bars[i], lo, step, bins);
} else {
for (let i = i0; i < i1; i++) spread(up, dn, bars[i], lo, step, bins);
}
return { up, dn };
}
function valueArea(totals, poc, pct) {
const target = (totals.reduce((a, b) => a + b, 0) * pct) / 100;
let acc = totals[poc], top = poc, bot = poc;
for (;;) {
const ai = top + 1, bi = bot - 1;
const av = ai < totals.length ? totals[ai] : -1, bv = bi >= 0 ? totals[bi] : -1;
if (av < 0 && bv < 0) break;
let takeAbove;
if (av !== bv) takeAbove = av > bv;
else takeAbove = (ai - poc) <= (poc - bi);
const v = takeAbove ? av : bv;
if (acc + v > target) break;
acc += v;
if (takeAbove) top = ai; else bot = bi;
}
return { top, bot, acc, target };
}
function profile(ix, t0, t1, vlo, vhi, { rows = 24, va = 70 } = {}) {
if (!ix || !(vhi > vlo)) return null;
const [i0, i1] = indexRange(ix.bars, t0, t1);
if (i1 <= i0) return null;
const { up, dn } = windowBins(ix, i0, i1);
const h = (vhi - vlo) / rows;
const rUp = new Array(rows).fill(0), rDn = new Array(rows).fill(0);
for (let k = 0; k < ix.bins; k++) {
if (!up[k] && !dn[k]) continue;
const c = ix.lo + (k + 0.5) * ix.step;
if (c < vlo || c > vhi) continue;
const r = Math.min(rows - 1, Math.floor((c - vlo) / h));
rUp[r] += up[k]; rDn[r] += dn[k];
}
const totals = rUp.map((u, i) => u + rDn[i]);
let poc = 0;
totals.forEach((t, i) => { if (t > totals[poc]) poc = i; });
const area = valueArea(totals, poc, va);
const mid = (i) => vlo + (i + 0.5) * h;
return {
rows: totals.map((t, i) => ({ lo: vlo + i * h, hi: vlo + (i + 1) * h, up: rUp[i], down: rDn[i], total: t, inVA: i >= area.bot && i <= area.top })),
poc: mid(poc), vah: vlo + (area.top + 1) * h, val: vlo + area.bot * h,
pocRow: poc, vaTop: area.top, vaBot: area.bot, bars: i1 - i0,
};
}
return { VP_TFS, VP_DEFAULTS, pickLowerTf, buildIndex, valueArea, profile };
})();
__M['public/core/drawings.js'] = (() => {
const { barIndexAt, PERIODS } = __M['public/core/time.js'];
const { T } = __M['public/core/theme.js'];
const DRAW_KINDS = { trend_line: 2, horizontal_line: 1, parallel_channel: 3, marker: 1, zone: 2, bar_span: 2 };
const TAG = (d) => (d.pending_delete ? '待刪' : d.temp ? '暫時' : d.card_draft ? '草稿' : null);
const MARKER_TYPES = ['buy', 'sell', 'plan', 'event'];
const toMs = (a) => (a?.ts != null ? Number(a.ts) : Date.parse(a?.time));
function logicalAt(data, tf, ms) {
if (!data.length || !Number.isFinite(ms)) return null;
const step = (PERIODS[tf]?.min || 5) * 60000;
const first = data[0].timestamp, last = data[data.length - 1].timestamp;
if (ms < first) return (ms - first) / step;
if (ms > last) return data.length - 1 + (ms - last) / step;
const i = barIndexAt(data, ms);
const next = data[i + 1]?.timestamp;
const span = next != null ? Math.min(step, next - data[i].timestamp) : step;
return i + Math.min(0.999, Math.max(0, (ms - data[i].timestamp) / span));
}
const colorOf = (d) => d.color || (d.created_by?.kind === 'agent' ? T.agent : T.human);
const markerTypeOf = (d) => ('marker_type' in d ? d.marker_type : d.properties?.marker_type ?? 'event');
function drawDrawings(ctx, c, data, xAxis, yAxis, bounding) {
c.drawHits = [];
const list = [...(c.drawings || [])];
if (c.drawDraft?.anchors?.length) list.push({ ...c.drawDraft, id: '__draft', draft: true });
if (!list.length || !data.length) return;
const W = bounding.width;
const X = (ms) => { const l = logicalAt(data, c.tf, ms); return l == null ? null : xAxis.convertToPixel(l); };
const Y = (p) => yAxis.convertToPixel(p);
ctx.save();
for (const d0 of list) {
const d = c.dragDraw?.id === d0.id ? { ...d0, anchors: c.dragDraw.anchors } : d0;
const need = DRAW_KINDS[d.kind];
if (!need || !Array.isArray(d.anchors) || (d.anchors.length < need && !d.draft)) continue;
const pts = d.anchors.map((a) => ({ x: X(toMs(a)), y: Y(Number(a.price)), price: Number(a.price) }));
if (pts.some((p) => p.x == null || !Number.isFinite(p.y))) continue;
const col = colorOf(d);
const sel = c.selectedDrawing === d.id || d.draft;
const hit = { id: d.id, segs: [], pts: pts.map((p, i) => ({ x: p.x, y: p.y, i })), rect: null };
const ALPHA = d.pending_delete ? 0.35 : 1;
ctx.globalAlpha = ALPHA;
ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = sel ? 2 : 1.5; ctx.setLineDash(d.draft || TAG(d) ? [4, 3] : []);
const line = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); hit.segs.push([x1, y1, x2, y2]); };
let labelAt = pts[0], mtText = null;
if (d.kind === 'trend_line') {
if (pts.length >= 2) line(pts[0].x, pts[0].y, pts[1].x, pts[1].y);
labelAt = pts[1] || pts[0];
} else if (d.kind === 'horizontal_line') {
line(0, pts[0].y, W, pts[0].y);
labelAt = { x: W - 8, y: pts[0].y, right: true };
} else if (d.kind === 'parallel_channel' && pts.length >= 2) {
const [A, B] = pts;
if (Math.abs(B.x - A.x) < 1e-6) continue;
const lA = logicalAt(data, c.tf, toMs(d.anchors[0])), lB = logicalAt(data, c.tf, toMs(d.anchors[1]));
let off = 0;
if (d.anchors[2]) {
const lC = logicalAt(data, c.tf, toMs(d.anchors[2]));
off = d.anchors[2].price - (A.price + ((B.price - A.price) * (lC - lA)) / (lB - lA));
}
const levels = Array.isArray(d.levels) && d.levels.length && d.levels.length <= 16 && d.levels.every((k) => Number.isFinite(k) && Math.abs(k) <= 100) ? d.levels : [0, 1];
if (d.anchors[2]) {
ctx.globalAlpha = 0.08 * ALPHA; ctx.beginPath();
ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.lineTo(B.x, Y(B.price + off)); ctx.lineTo(A.x, Y(A.price + off)); ctx.closePath(); ctx.fill();
ctx.globalAlpha = ALPHA;
}
for (const k of levels) {
ctx.setLineDash(k === 0 || k === 1 ? (d.draft ? [4, 3] : []) : [4, 4]);
line(A.x, Y(A.price + k * off), B.x, Y(B.price + k * off));
}
ctx.setLineDash([]);
labelAt = B;
} else if (d.kind === 'bar_span' && pts.length >= 2) {
const half = Math.max(2, Math.abs(xAxis.convertToPixel(1) - xAxis.convertToPixel(0)) / 2);
const x0 = Math.min(pts[0].x, pts[1].x) - half, x1 = Math.max(pts[0].x, pts[1].x) + half;
ctx.globalAlpha = 0.14 * ALPHA; ctx.fillRect(x0, 0, x1 - x0, bounding.height); ctx.globalAlpha = ALPHA;
hit.rect = { x0, x1, y0: 0, y1: bounding.height };
labelAt = { x: x0 + 2, y: 14 };
} else if (d.kind === 'zone' && pts.length >= 2) {
const x0 = Math.min(pts[0].x, pts[1].x), x1 = Math.max(pts[0].x, pts[1].x), y0 = Math.min(pts[0].y, pts[1].y), y1 = Math.max(pts[0].y, pts[1].y);
ctx.globalAlpha = 0.12 * ALPHA; ctx.fillRect(x0, y0, x1 - x0, y1 - y0); ctx.globalAlpha = ALPHA;
ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
hit.rect = { x0, x1, y0, y1 };
labelAt = { x: x0 + 2, y: y0 - 2, above: true };
} else if (d.kind === 'marker') {
const mt = markerTypeOf(d);
if (!MARKER_TYPES.includes(mt)) continue;
const { x, y } = pts[0], r = 7;
ctx.beginPath();
if (mt === 'buy') { ctx.moveTo(x, y - r); ctx.lineTo(x + r, y + r * 0.7); ctx.lineTo(x - r, y + r * 0.7); }
else if (mt === 'sell') { ctx.moveTo(x, y + r); ctx.lineTo(x + r, y - r * 0.7); ctx.lineTo(x - r, y - r * 0.7); }
else if (mt === 'plan') { ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); }
else ctx.arc(x, y, r * 0.75, 0, Math.PI * 2);
ctx.closePath(); ctx.fill();
ctx.strokeStyle = T.bg; ctx.lineWidth = 1; ctx.stroke();
hit.rect = { x0: x - r - 2, x1: x + r + 2, y0: y - r - 2, y1: y + r + 2 };
labelAt = { x: x + r + 3, y };
mtText = mt;
}
const base = d.label ? (d.kind === 'marker' ? `${d.label} · ${mtText}` : d.label) : d.kind === 'marker' ? mtText : '';
const text = TAG(d) ? `${TAG(d)}${base ? ` · ${base}` : ''}` : base;
if (text && labelAt) {
ctx.font = '11px sans-serif'; ctx.textBaseline = labelAt.above ? 'bottom' : 'middle';
ctx.textAlign = labelAt.right ? 'right' : 'left';
const tw = ctx.measureText(text).width;
const tx = labelAt.right ? labelAt.x - tw : labelAt.x + 4, ty = labelAt.above ? labelAt.y - 6 : labelAt.y - 9;
ctx.globalAlpha = 0.75 * ALPHA; ctx.fillStyle = T.panel; ctx.fillRect(tx - 3, ty - 1, tw + 6, 15); ctx.globalAlpha = ALPHA;
ctx.fillStyle = col; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(text, tx, ty + 6.5);
}
if (sel) for (const p of hit.pts) { ctx.fillStyle = T.bg; ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
ctx.globalAlpha = 1;
c.drawHits.push(hit);
}
ctx.restore();
}
function drawingAt(c, p, tol = 6) {
const hits = c.drawHits || [];
const sel = hits.find((h) => h.id === c.selectedDrawing);
const handle = sel?.pts.find((q) => Math.hypot(q.x - p.x, q.y - p.y) <= tol + 2);
if (handle) return { id: sel.id, anchor: handle.i };
for (const h of [...hits].reverse()) {
if (h.id === '__draft') continue;
if (h.rect && p.x >= h.rect.x0 && p.x <= h.rect.x1 && p.y >= h.rect.y0 && p.y <= h.rect.y1) return { id: h.id };
for (const [x1, y1, x2, y2] of h.segs) {
const dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy;
const t = L ? Math.max(0, Math.min(1, ((p.x - x1) * dx + (p.y - y1) * dy) / L)) : 0;
if (Math.hypot(p.x - (x1 + t * dx), p.y - (y1 + t * dy)) <= tol) return { id: h.id };
}
}
return null;
}
return { DRAW_KINDS, MARKER_TYPES, logicalAt, markerTypeOf, drawDrawings, drawingAt };
})();
__M['public/core/chart.js'] = (() => {
const { PERIODS, TZ, barIndexAt, barNumbers } = __M['public/core/time.js'];
const { orderView, fmtPnl, ORDER_STATUS, planUnderlying, planTable, rightOf, legSideOk, bracketOk } = __M['public/core/options.js'];
const { groupOf, tradePath } = __M['public/core/layers.js'];
const { T, chartStyles } = __M['public/core/theme.js'];
const { profile } = __M['public/core/vp.js'];
const { drawDrawings, drawingAt, DRAW_KINDS } = __M['public/core/drawings.js'];
const CANDLE = 'candle_pane';
const CTX = new Map(); // chart.id -> per-chart render context
let registered = false;
const COLLAPSE = { id: 'collapse', position: 'left', marginLeft: 6, marginTop: 4, paddingLeft: 2, paddingRight: 2,
paddingTop: 0, paddingBottom: 0, size: 11, color: T.muted, activeColor: T.text, backgroundColor: 'transparent',
activeBackgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, type: 'icon_font' };
const EYE = 'M1 6 Q6 0 11 6 Q6 12 1 6 Z M4.5 6 Q4.5 4.5 6 4.5 Q7.5 4.5 7.5 6 Q7.5 7.5 6 7.5 Q4.5 7.5 4.5 6 Z';
const EYE_OFF = 'M1 6 Q6 0 11 6 Q6 12 1 6 Z M1 11 L11 1';
function fmtNum(v, p) { return v == null ? 'n/a' : Number(v).toFixed(p); }
function templateFor(meta) {
const lines = meta.plot?.lines || [];
const hist = meta.plot?.hist || [];
const figures = [
...lines.map((l) => ({ key: l.key, title: `${l.title}: `, type: 'line' })),
...hist.map((h) => ({
key: h.key, title: `${h.title}: `, type: 'bar', baseValue: 0,
styles: ({ data }) => {
const c = data.current?.[h.key] ?? 0, p = data.prev?.[h.key] ?? 0;
if (h.dirKey) { const col = data.current?.[h.dirKey] ? T.up : T.down; return { color: col, borderColor: col, style: 'fill' }; }
const color = c >= 0 ? T.up : T.down;
return { color, borderColor: color, style: (c >= 0 ? c >= p : c <= p) ? 'fill' : 'stroke' };
},
})),
];
return {
name: meta.name, shortName: meta.name, series: meta.pane === 'main' ? 'price' : 'normal',
precision: meta.precision ?? 2, calcParams: [], figures,
styles: { lines: lines.map((l) => ({ color: l.color, size: l.width ?? 1, style: l.dash ? 'dashed' : 'solid', smooth: !!l.smooth, dashedValue: l.dash || [] })) },
calc: (dataList, ind) => {
const rows = ind.extendData?.rows || [];
return dataList.map((_, i) => rows[i] || {});
},
createTooltipDataSource: ({ chart, indicator, crosshair }) => {
const c = CTX.get(chart.id);
const open = !!c?.legendOpen[indicator.name];
const features = [
{ ...COLLAPSE, id: 'eye', type: 'path', size: 12, marginLeft: 4, marginTop: 5, paddingLeft: 1, paddingRight: 1,
color: indicator.visible ? T.text : T.muted, activeColor: '#ffffff',
content: { style: 'stroke', lineWidth: 1.2, path: indicator.visible ? EYE : EYE_OFF } },
{ ...COLLAPSE, content: { family: 'sans-serif', code: open ? '▾' : '▸' } },
];
if (!open || !indicator.visible) return { name: meta.name, calcParamsText: '', legends: [], features };
const i = crosshair?.dataIndex ?? (indicator.result.length - 1);
const row = indicator.result[i] || {};
const legends = [
...lines.map((l) => ({ title: { text: `${l.title}: `, color: l.color }, value: { text: fmtNum(row[l.key], indicator.precision), color: l.color } })),
...hist.map((h) => ({ title: `${h.title}: `, value: { text: fmtNum(row[h.key], indicator.precision), color: (h.dirKey ? row[h.dirKey] : (row[h.key] ?? 0) >= 0) ? T.up : T.down } })),
];
return { name: meta.name, calcParamsText: meta.paramsText ? `(${meta.paramsText})` : '', legends, features };
},
draw: meta.plot?.marks ? drawMarks : meta.plot?.custom === 'vrvp' ? drawVrvp : meta.plot?.custom === 'volOverlay' ? drawVolOverlay
: meta.plot?.custom === 'gaps' ? drawGaps : null,
};
}
function drawGaps({ ctx, chart, indicator, bounding, xAxis, yAxis }) {
const rows = indicator.result;
const last = rows.at(-1);
if (!last?.gaps?.length) return true;
const data = chart.getDataList();
const right = xAxis.convertToPixel(data.length - 1) + chart.getBarSpace().halfBar;
ctx.save();
for (const g of last.gaps) {
const i = barIndexAt(data, g.start);
if (i < 0) continue;
const x0 = xAxis.convertToPixel(i) - chart.getBarSpace().halfBar;
if (x0 > bounding.width) continue;
const y0 = yAxis.convertToPixel(g.top), y1 = yAxis.convertToPixel(g.bottom);
ctx.fillStyle = 'rgba(255,255,255,0.10)';
ctx.fillRect(x0, Math.min(y0, y1), Math.max(1, Math.min(right, bounding.width) - x0), Math.max(1, Math.abs(y1 - y0)));
ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1;
ctx.beginPath(); ctx.moveTo(x0 + 0.5, Math.min(y0, y1)); ctx.lineTo(x0 + 0.5, Math.max(y0, y1)); ctx.stroke(); // faint left edge only
}
ctx.restore();
return true;
}
function drawVolOverlay({ ctx, chart, indicator, bounding, xAxis }) {
const c = CTX.get(chart.id);
const rows = indicator.result;
const { from, to } = chart.getVisibleRange();
let max = 0;
for (let i = Math.max(0, from); i < to; i++) max = Math.max(max, rows[i]?.vol || 0, rows[i]?.ma10 || 0);
if (!max) return true;
const bottom = bounding.height - (c?.eventRowH ?? 30) - (c?.showBarNo && !c?.compact ? 30 : 0);
const H = bounding.height * 0.2;
const bw = Math.max(1, chart.getBarSpace().gapBar);
ctx.save();
for (let i = Math.max(0, from); i < to; i++) {
const r = rows[i];
if (!r?.vol) continue;
const x = xAxis.convertToPixel(i), h = (r.vol / max) * H;
ctx.fillStyle = r.up ? 'rgba(38,166,154,0.3)' : 'rgba(239,83,80,0.3)';
ctx.fillRect(x - bw / 2, bottom - h, bw, h);
}
for (const [key, color] of [['ma5', 'rgba(247,197,72,0.8)'], ['ma10', 'rgba(41,182,246,0.8)']]) {
ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.beginPath();
let started = false;
for (let i = Math.max(0, from); i < to; i++) {
const v = rows[i]?.[key];
if (v == null) continue;
const x = xAxis.convertToPixel(i), y = bottom - (v / max) * H;
if (started) ctx.lineTo(x, y); else { ctx.moveTo(x, y); started = true; }
}
ctx.stroke();
}
ctx.restore();
return true;
}
function drawVrvp({ ctx, chart, bounding, yAxis }) {
const c = CTX.get(chart.id);
const vp = c?.vp;
if (!vp?.index) return true;
const data = chart.getDataList();
const { from, to } = chart.getVisibleRange();
const vis = data.slice(Math.max(0, from), to);
if (!vis.length) return true;
let lo = Infinity, hi = -Infinity;
for (const b of vis) { if (b.low < lo) lo = b.low; if (b.high > hi) hi = b.high; }
const t0 = vis[0].timestamp;
const next = data[Math.min(to, data.length - 1)];
const t1 = to < data.length ? next.timestamp : vis.at(-1).timestamp + 864e5 * 400;
const key = `${t0}:${t1}:${lo}:${hi}:${vp.opts.rows}:${vp.opts.va}:${vp.version}`;
if (vp.key !== key) { vp.key = key; vp.result = profile(vp.index, t0, t1, lo, hi, vp.opts); }
const pr = vp.result;
c.vpResult = pr;
if (!pr) return true;
const maxW = bounding.width * (vp.opts.width / 100);
const mode = vp.opts.mode;
const val = (r) => (mode === 'delta' ? Math.abs(r.up - r.down) : r.total);
ctx.save();
const rowPx = Math.abs(yAxis.convertToPixel(pr.rows[0].lo) - yAxis.convertToPixel(pr.rows.at(-1).hi)) / pr.rows.length;
const per = Math.max(1, Math.ceil(1 / Math.max(rowPx, 1e-6)));
const drawRows = [];
for (let i = 0; i < pr.rows.length; i += per) {
const grp = pr.rows.slice(i, i + per);
drawRows.push({ lo: grp[0].lo, hi: grp.at(-1).hi, up: grp.reduce((a, r) => a + r.up, 0), down: grp.reduce((a, r) => a + r.down, 0),
total: grp.reduce((a, r) => a + r.total, 0), inVA: grp.some((r) => r.inVA), poc: grp.includes(pr.rows[pr.pocRow]) });
}
const dmax = Math.max(...drawRows.map(val)) || 1;
const R = bounding.width;
let prevTop = Infinity;
for (const r of drawRows) {
const yBot = Math.min(Math.round(yAxis.convertToPixel(r.lo)), prevTop);
const yTop = Math.round(yAxis.convertToPixel(r.hi));
if (yBot <= yTop) continue;
prevTop = yTop;
const h = yBot - yTop - (per === 1 && rowPx > 3 ? 1 : 0);
const a = r.poc ? 0.4 : r.inVA ? 0.25 : 0.18;
if (mode === 'updown') {
const wu = (r.up / dmax) * maxW, wd = (r.down / dmax) * maxW;
ctx.fillStyle = `rgba(38,166,154,${a})`; ctx.fillRect(R - wu, yTop, wu, h);
ctx.fillStyle = `rgba(239,83,80,${a})`; ctx.fillRect(R - wu - wd, yTop, wd, h);
} else if (mode === 'delta') {
const w = (val(r) / dmax) * maxW;
ctx.fillStyle = r.up >= r.down ? `rgba(38,166,154,${a})` : `rgba(239,83,80,${a})`;
ctx.fillRect(R - w, yTop, w, h);
} else {
const w = (r.total / dmax) * maxW;
ctx.fillStyle = `rgba(120,123,134,${a + 0.05})`; ctx.fillRect(R - w, yTop, w, h);
}
}
ctx.restore();
return true;
}
function badge(ctx, x, y, text, color, style) {
ctx.font = '700 11px sans-serif';
const h = 18, w = Math.max(h, ctx.measureText(text).width + 10);
ctx.beginPath();
if (ctx.roundRect) ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2); else ctx.rect(x - w / 2, y - h / 2, w, h);
ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
if (style === 'hollow') {
ctx.fillStyle = T.bg; ctx.fill();
ctx.lineWidth = 1.5; ctx.strokeStyle = color; ctx.stroke();
ctx.fillStyle = color;
} else {
ctx.fillStyle = color; ctx.fill();
ctx.fillStyle = T.badgeText;
}
ctx.fillText(text, x, y + 0.5);
}
function drawMarks({ ctx, chart, indicator, xAxis, yAxis }) {
const data = chart.getDataList();
const { from, to } = chart.getVisibleRange();
for (let i = from; i < to; i++) {
const r = indicator.result[i], d = data[i];
if (!r?.marks?.length || !d) continue;
const x = xAxis.convertToPixel(i);
let above = 0, below = 0;
for (const m of r.marks) {
const color = m.color === 'bull' ? T.up : m.color === 'bear' ? T.down : m.color;
const rank = m.above ? above++ : below++;
const off = 6 + 9 + rank * (18 + 3);
const y = m.above ? yAxis.convertToPixel(d.high) - off : yAxis.convertToPixel(d.low) + off;
badge(ctx, x, y, m.text, color, m.style);
}
}
return false;
}
function sysDraw({ ctx, chart, bounding, xAxis, yAxis }) {
const c = CTX.get(chart.id);
if (!c) return false;
const data = chart.getDataList();
const { from, to } = chart.getVisibleRange();
const space = chart.getBarSpace().bar;
ctx.save();
drawDrawings(ctx, c, data, xAxis, yAxis, bounding);
for (const s of c.signals) {
const color = s.author === 'agent' ? T.agent : T.human;
for (const t of s.triggers || []) {
const i = barIndexAt(data, t.ts);
if (i < from || i >= to) continue;
const x = xAxis.convertToPixel(i);
const y = yAxis.convertToPixel(t.price);
ctx.fillStyle = color; ctx.strokeStyle = T.bg; ctx.lineWidth = 1.5;
ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.lineTo(x + 7, y); ctx.lineTo(x, y + 9); ctx.lineTo(x - 7, y); ctx.closePath();
ctx.fill(); ctx.stroke();
ctx.fillStyle = T.badgeText; ctx.font = '700 9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
ctx.fillText('S', x, y + 0.5);
}
}
for (const o of c.orders) {
if (o.kind === 'plan' || !o.filled_at || !c.visibleLegs?.has(`${tradePath(c.state, o)}/entry`)) continue;
const pts = [];
for (const [ts, px, kind] of [[o.filled_at, o.fill_spot ?? o.linePrice, 'in'], [o.closed_at, o.exit_spot, o.exit_reason]]) {
if (!ts || px == null || !inLoaded(data, ts)) continue;
const i = barIndexAt(data, ts);
if (i < from - 1 || i > to + 1) continue;
pts.push({ x: xAxis.convertToPixel(i), y: yAxis.convertToPixel(px), kind });
}
if (pts.length === 2) { ctx.strokeStyle = '#e1e4ea'; ctx.setLineDash([2, 3]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[1].x, pts[1].y); ctx.stroke(); ctx.setLineDash([]); }
for (const p of pts) {
const col = p.kind === 'in' ? '#2962ff' : p.kind === 'tp' ? T.up : T.down;
ctx.fillStyle = col; ctx.strokeStyle = T.bg; ctx.lineWidth = 1.5;
ctx.beginPath();
if (p.kind === 'in') { ctx.moveTo(p.x, p.y - 7); ctx.lineTo(p.x + 7, p.y + 5); ctx.lineTo(p.x - 7, p.y + 5); }
else { ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); }
ctx.closePath(); ctx.fill(); ctx.stroke();
if (p.kind !== 'in') { ctx.fillStyle = '#fff'; ctx.font = '700 8px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.kind.toUpperCase(), p.x, p.y + 0.5); }
}
}
if (c.replayTs != null && inLoaded(data, c.replayTs)) {
const x = xAxis.convertToPixel(barIndexAt(data, c.replayTs));
ctx.strokeStyle = 'rgba(255,209,102,0.9)'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, bounding.height); ctx.stroke(); ctx.setLineDash([]);
}
if (c.showBarNo) {
const nums = c.barNo;
const step = Math.max(2, 2 * Math.ceil(30 / (2 * Math.max(space, 0.1))));
const yNum = bounding.height - 50;
ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
for (let i = Math.max(from, 0); i < to; i++) {
const b = nums[i];
if (!b || b.n % 2 !== 0 || b.n % step !== 0) continue;
const x = xAxis.convertToPixel(i);
ctx.fillStyle = T.text; ctx.font = 'bold 10px sans-serif'; ctx.fillText(String(b.n), x, yNum);
ctx.fillStyle = T.muted; ctx.font = '9px sans-serif'; ctx.fillText(b.start, x, yNum + 11);
}
}
drawIntakeMarks(ctx, c, data, from, to, xAxis, yAxis);
drawFillBadges(ctx, c, data, from, to, xAxis, yAxis);
drawEventRow(ctx, c, data, from, to, bounding, xAxis);
c.edgeHit = null;
const edge = c.loadingOlder ? { text: '下載中…' } : c.edge;
if (edge && from <= 0) {
ctx.font = '11px sans-serif';
const w = ctx.measureText(edge.text).width + 14, y = bounding.height / 2;
ctx.fillStyle = 'rgba(30,34,45,0.9)'; ctx.fillRect(4, y - 11, w, 22);
ctx.strokeStyle = edge.retry ? T.down : T.border; ctx.lineWidth = 1; ctx.strokeRect(4.5, y - 10.5, w - 1, 21);
ctx.fillStyle = edge.retry ? T.down : T.muted; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
ctx.fillText(edge.text, 11, y);
if (edge.retry) c.edgeHit = { x0: 4, x1: 4 + w, y0: y - 11, y1: y + 11 };
}
drawLevels(ctx, c, bounding, yAxis);
ctx.restore();
return false;
}
function drawIntakeMarks(ctx, c, data, from, to, xAxis, yAxis) {
c.intakeHits = [];
const fixes = c.intakeFixes || [];
if (!fixes.length) return;
const byBar = new Map();
for (const f of fixes) {
const i = barIndexAt(data, f.time);
if (i < from || i >= to || data[i]?.timestamp !== f.time) continue;
if (!byBar.has(i)) byBar.set(i, []);
byBar.get(i).push(f);
}
ctx.save();
ctx.strokeStyle = 'rgba(178,181,190,0.75)'; ctx.lineWidth = 1;
for (const [i, list] of byBar) {
const x = xAxis.convertToPixel(i);
for (const f of list) {
const y = yAxis.convertToPixel(f.field === 'high' ? data[i].high : data[i].low);
const dir = f.field === 'high' ? -1 : 1;
ctx.setLineDash([2, 2]); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + dir * 6); ctx.stroke(); ctx.setLineDash([]);
ctx.beginPath(); ctx.arc(x, y + dir * 9, 2.5, 0, Math.PI * 2); ctx.stroke();
c.intakeHits.push({ x, y: y + dir * 9, r: 6, fix: f });
}
}
ctx.restore();
}
function drawFillBadges(ctx, c, data, from, to, xAxis, yAxis) {
const byBar = new Map();
for (const f of c.fills) {
if (!inLoaded(data, f.ts)) continue;
const i = barIndexAt(data, f.ts);
if (i < from || i >= to) continue;
if (!byBar.has(i)) byBar.set(i, new Set());
byBar.get(i).add(f.side);
}
for (const [i, sides] of byBar) {
const x = xAxis.convertToPixel(i);
const y = yAxis.convertToPixel(data[i].low) + 15;
const color = sides.size > 1 || sides.has('spread') ? T.agent : sides.has('buy') ? T.up : T.down;
ctx.fillStyle = color; ctx.strokeStyle = T.bg; ctx.lineWidth = 1.5;
ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
ctx.fillStyle = T.badgeText; ctx.font = '700 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
ctx.fillText('$', x, y + 0.5);
}
}
const EV_R = 8, EV_GAP = 3, ROW_H = 30;
const EVENT_KINDS = {
note: { icon: '✎', title: 'Note' },
signal: { icon: '◆', title: 'Signal' },
event: { icon: '⚡', title: '事件' },
fill: { icon: '$', title: '成交' },
};
function inLoaded(data, ts) {
if (!data.length) return false;
const last = data.at(-1), span = data.length > 1 ? last.timestamp - data.at(-2).timestamp : 864e5;
return ts >= data[0].timestamp && ts < last.timestamp + span;
}
function eventsByBar(c, data) {
const by = new Map();
const add = (ts, item) => {
if (!inLoaded(data, ts)) return;
const i = barIndexAt(data, ts);
if (i < 0) return;
if (!by.has(i)) by.set(i, []);
by.get(i).push({ ...item, barIndex: i, barTs: data[i].timestamp });
};
for (const n of c.notes) add(n.ts, { kind: n.kind === 'event' ? 'event' : 'note', author: n.author, agent: n.path.startsWith('agent/') ? n.path.split('/')[1] : null, title: n.text, body: n.text, ts: n.ts, path: n.path });
for (const f of c.fills) {
const side = f.side === 'buy' ? '買' : f.side === 'sell' ? '賣' : f.side;
add(f.ts, { kind: 'fill', side: f.side, author: f.author, agent: f.path.startsWith('agent/') ? f.path.split('/')[1] : null,
title: f.text, body: `${side} ${f.qty ?? ''} ${f.contract ?? ''}`.replace(/\s+/g, ' ').trim(), ts: f.ts, price: f.price, path: f.path });
}
for (const s of c.signals) for (const t of s.triggers || []) add(t.ts, { kind: 'signal', author: s.author, agent: s.agent, title: s.name, body: t.note || '', ts: t.ts, price: t.price, path: s.path });
return by;
}
const KIND_ORDER = ['fill', 'note', 'signal', 'event'];
function drawEventRow(ctx, c, data, from, to, bounding, xAxis) {
c.eventHits = [];
const bars = [...eventsByBar(c, data)].filter(([i]) => i >= from && i < to).sort((a, b) => a[0] - b[0]);
const groups = [];
for (const [i, items] of bars) {
const x = xAxis.convertToPixel(i);
const g = groups.at(-1);
if (g && x - g.x < EV_R * 2 + 2) g.items.push(...items);
else groups.push({ x, items: [...items] });
}
const tallest = Math.max(1, ...groups.map((g) => KIND_ORDER.filter((kd) => g.items.some((it) => it.kind === kd)).length));
const rowH = Math.max(ROW_H, tallest * (EV_R * 2 + EV_GAP) + 8);
c.eventRowH = rowH;
const base = bounding.height - ROW_H / 2;
ctx.fillStyle = T.noteRow;
ctx.fillRect(0, bounding.height - rowH, bounding.width, rowH);
ctx.strokeStyle = T.border; ctx.lineWidth = 1;
ctx.beginPath(); ctx.moveTo(0, bounding.height - rowH); ctx.lineTo(bounding.width, bounding.height - rowH); ctx.stroke();
for (const g of groups) {
let k = 0;
for (const kind of KIND_ORDER) {
const items = g.items.filter((it) => it.kind === kind);
if (!items.length) continue;
const y = base - k * (EV_R * 2 + EV_GAP);
k += 1;
const authors = new Set(items.map((it) => it.author));
ctx.strokeStyle = T.bg; ctx.lineWidth = 1.5;
if (kind === 'fill') {
const sides = new Set(items.map((it) => it.side));
ctx.fillStyle = sides.size > 1 || sides.has('spread') ? T.agent : sides.has('buy') ? T.up : T.down;
ctx.beginPath(); ctx.arc(g.x, y, EV_R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
} else if (authors.size > 1) { // mixed: left half human, right half agent
ctx.fillStyle = T.human; ctx.beginPath(); ctx.arc(g.x, y, EV_R, Math.PI / 2, Math.PI * 1.5); ctx.fill();
ctx.fillStyle = T.agent; ctx.beginPath(); ctx.arc(g.x, y, EV_R, -Math.PI / 2, Math.PI / 2); ctx.fill();
ctx.beginPath(); ctx.arc(g.x, y, EV_R, 0, Math.PI * 2); ctx.stroke();
} else {
ctx.fillStyle = authors.has('agent') ? T.agent : T.human;
ctx.beginPath(); ctx.arc(g.x, y, EV_R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
}
ctx.fillStyle = T.badgeText; ctx.font = kind === 'fill' ? '700 11px sans-serif' : '10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
ctx.fillText(EVENT_KINDS[kind].icon, g.x, y + 0.5);
if (items.length > 1) {
const t = items.length > 99 ? '99+' : String(items.length);
ctx.font = '700 9px sans-serif';
const w = Math.max(12, ctx.measureText(t).width + 6);
const bx = g.x + EV_R - 3, by = y - EV_R + 1;
ctx.fillStyle = '#e1e4ea';
ctx.beginPath();
if (ctx.roundRect) ctx.roundRect(bx - w / 2, by - 6, w, 12, 6); else ctx.rect(bx - w / 2, by - 6, w, 12);
ctx.fill();
ctx.fillStyle = T.bg; ctx.fillText(t, bx, by + 0.5);
}
c.eventHits.push({ x: g.x, y, r: EV_R + 2, kind, items, groupItems: g.items });
}
}
}
const LEVEL_ALPHA = 0.65;
const LABEL_H = 18, LABEL_GAP = 2;
const pnlColor = (p) => (!p || Math.abs(p.usd) < 0.5 ? '#e1e4ea' : p.usd > 0 ? T.up : T.down);
const signed = (v) => (v >= 0 ? '+' : '') + Math.round(v);
const LEG = { entry: { color: '#2962ff', name: 'Entry' }, tp: { color: '#26a69a', name: 'TP' }, sl: { color: '#f2c94c', name: 'SL' } };
function wrongSide(o, leg, price, entry) {
const r = rightOf(o);
if (leg === 'entry') return !bracketOk(r, { linePrice: price, tp: o.tp, sl: o.sl });
return !legSideOk(r, entry ?? o.linePrice, leg, price);
}
const isDragged = (c, o, leg, id) => !c.groupDelta && (c.dragPrice?.[id] != null || (c.creating?.orderId === o.id && c.creating.leg === leg));
const BAD = { text: '', color: '#ffffff', bg: '#ef5350', chip: true };
const legHead = (leg, bad) => (bad ? { ...BAD, text: ` ${LEG[leg].name} ✕ 錯邊 ` } : { text: `${LEG[leg].name} `, color: LEG[leg].color, bold: true });
const UNSENT = new Set(['Filled', 'Cancelled', 'ApiCancelled', 'Rejected', 'Inactive', 'Closed']);
const rightChip = (right, canFlip) => ({ text: ` ${right}${canFlip ? ' ⇄' : ''} `, color: right === 'C' ? '#0b1d17' : '#2b0b18',
bg: right === 'C' ? 'rgba(38,166,154,0.85)' : 'rgba(239,83,80,0.85)', chip: true, act: canFlip ? 'flip' : null });
const legPrice = (c, o, leg) => c.dragPrice?.[`order:${o.id}:${leg}`] ?? (leg === 'entry' ? o.linePrice : o[leg]);
const samePriceOrders = (c, pl, leg) => c.orders.filter((o) => o.from_plan === pl.id && legPrice(c, o, leg) != null
&& legPrice(c, pl, leg) != null && Math.abs(legPrice(c, o, leg) - legPrice(c, pl, leg)) < 0.005);
function planItems(c, pl, items) {
for (const leg of ['entry', 'tp', 'sl']) {
const pending = c.creating?.orderId === pl.id && c.creating.leg === leg;
const base = leg === 'entry' ? pl.linePrice : (pending ? c.creating.price : pl[leg]);
if (base == null || (!pending && !c.visibleLegs?.has(`${tradePath(c.state, pl)}/${leg}`))) continue;
if (!pending && samePriceOrders(c, pl, leg).length) continue;
const id = `order:${pl.id}:${leg}`;
const price = c.dragPrice?.[id] ?? base;
const head = [];
if (leg === 'entry' && !c.compact) {
if (pl.tp == null) head.push({ text: 'TP', color: '#0b1d17', bg: 'rgba(38,166,154,0.7)', chip: true, handle: 'tp' });
if (pl.sl == null) head.push({ text: 'SL', color: '#2b2205', bg: 'rgba(242,201,76,0.7)', chip: true, handle: 'sl' });
head.push({ text: ' PLAN ', color: '#d1d4dc', bg: 'rgba(120,123,134,0.35)', chip: true, plan: true });
head.push(rightChip(rightOf(pl), !c.orders.some((x) => x.from_plan === pl.id && (x.sent || x.status === 'Filled'))));
}
if (leg === 'entry' && c.groupDelta?.entryKeys.has(id)) {
const gd = c.groupDelta.delta;
head.push({ text: ` ${gd >= 0 ? '+' : '−'}${Math.abs(gd).toFixed(2)} `, color: '#0b1d2b', bg: '#ffd166', chip: true });
}
const bad = isDragged(c, pl, leg, id) && wrongSide(pl, leg, price, legPrice(c, pl, 'entry'));
head.push(legHead(leg, bad));
head.push({ text: leg === 'entry' ? `${pl.label} · ${pl.candidates?.length || 0} 候選` : '', color: T.muted });
head.push({ text: '  ⋮⋮', color: '#b2b5be', grip: true });
const live = { ...pl, [leg === 'entry' ? 'linePrice' : leg]: price };
for (const lg of ['entry', 'tp', 'sl']) { const k = `order:${pl.id}:${lg}`; if (c.dragPrice?.[k] != null) live[lg === 'entry' ? 'linePrice' : lg] = c.dragPrice[k]; }
if (c.creating?.orderId === pl.id) live[c.creating.leg] = c.creating.price;
const second = [{ text: `@${price.toFixed(2)}`, color: '#b2b5be' }];
const chosen = (pl.candidates || []).find((x) => x.chosen);
const u = planUnderlying(live);
if (!chosen) {
if (leg !== 'entry' && u[leg]) {
const m = u[leg];
second.push({ text: `  ${m.pts >= 0 ? '+' : ''}${m.pts.toFixed(2)} (${m.pct >= 0 ? '+' : ''}${m.pct.toFixed(2)}%)`, color: m.gain > 0 ? T.up : T.down });
}
if (leg === 'entry' && u.rr != null) second.push({ text: `  R:R ${u.rr.toFixed(2)}`, color: '#e1e4ea', bold: true });
} else if (!c.compact) {
const row = planTable({ ...live, candidates: [chosen] }, (sym) => c.quotes[sym]?.mark_iv ?? null)[0];
const p = leg === 'entry' ? row.entry : leg === 'tp' ? row.at_tp : row.at_sl;
const pnl = leg === 'tp' ? row.pnl_tp : leg === 'sl' ? row.pnl_sl : null;
if (p != null) second.push({ text: ` → ${p.toFixed(2)} ★${row.name.replace(/^\S+\s+/, '')}`, color: '#e1e4ea' });
if (pnl != null) second.push({ text: `  ${signed(pnl)}`, color: pnlColor({ usd: pnl }) });
if (leg === 'entry' && row.rr != null) second.push({ text: `  R:R ${row.rr.toFixed(2)}`, color: '#e1e4ea', bold: true });
}
let lines = [head, second];
if (!bracketOpen(c, pl.id)) {
if (leg === 'entry') {
const rr = chosen ? planTable({ ...live, candidates: [chosen] }, (sym) => c.quotes[sym]?.mark_iv ?? null)[0].rr : u.rr;
lines = [[{ text: ' PLAN ', color: '#d1d4dc', bg: 'rgba(120,123,134,0.35)', chip: true, plan: true }, { text: ` R:R ${rr != null ? rr.toFixed(2) : '—'}`, color: '#e1e4ea', bold: true }]];
} else {
let val = null;
if (chosen) {
const row = planTable({ ...live, candidates: [chosen] }, (sym) => c.quotes[sym]?.mark_iv ?? null)[0];
val = leg === 'tp' ? row.pnl_tp : row.pnl_sl;
}
const m = u[leg];
const txt = val != null ? signed(val).replace('-', '−') : m ? `${m.pts >= 0 ? '+' : '−'}${Math.abs(m.pts).toFixed(2)}` : '—';
lines = [[{ text: `${LEG[leg].name} `, color: LEG[leg].color, bold: true }, { text: txt, color: leg === 'tp' ? T.up : T.down, bold: true }]];
}
}
items.push({ id, orderId: pl.id, group: groupOf(pl), leg, price, lines, color: bad ? '#ef5350' : LEG[leg].color, hot: c.hot === id, dash: [1, 4], plan: true });
}
}
const INACTIVE = new Set(['Filled', 'Cancelled', 'ApiCancelled', 'Rejected', 'Closed']);
function focusGroup(c) {
if (c.lockedGroup) return c.lockedGroup;
const id = c.creating?.orderId || (c.hot && c.hot.startsWith('order:') ? c.hot.split(':')[1] : null);
const o = id && c.orders.find((x) => x.id === id);
return o ? groupOf(o) : (c.treeFocus || null);
}
function bracketOpen(c, id) {
const o = c.orders.find((x) => x.id === id);
return !!o && focusGroup(c) === groupOf(o);
}
function levelItems(c) {
const items = [];
for (const o of c.orders) {
if (o.kind === 'plan') { planItems(c, o, items); continue; }
if (o.status === 'Closed' && c.reviewFocus !== groupOf(o)) continue;
const q = c.quotes[o.option];
const v0 = orderView(o, q, o.linePrice);
const short = v0.name.replace(/^\S+\s+\d{4}\s+/, '');
const ready = !o.sent && !UNSENT.has(o.status);
const st = ready ? { color: '#3b82f6', text: '#ffffff', label: 'Ready' } : ORDER_STATUS[o.status] || ORDER_STATUS.UNKNOWN;
for (const leg of ['entry', 'tp', 'sl']) {
const pending = c.creating?.orderId === o.id && c.creating.leg === leg;
const base = leg === 'entry' ? o.linePrice : (pending ? c.creating.price : o[leg]);
if (base == null || (!pending && !c.visibleLegs?.has(`${tradePath(c.state, o)}/${leg}`))) continue;
const id = `order:${o.id}:${leg}`;
const price = c.dragPrice?.[id] ?? base;
const v = orderView(o, q, price);
if (leg !== 'entry') {
const eIdx = `order:${o.id}:entry`;
const ve = orderView(o, q, c.dragPrice?.[eIdx] ?? o.linePrice);
v.predPnl = v.predicted != null && ve.predicted != null ? { usd: o.qty * 100 * (v.predicted - ve.predicted) } : null;
}
const hot = c.hot === id;
const lines = [];
const head = [];
const parentPlan = o.from_plan && c.orders.find((x) => x.id === o.from_plan && x.kind === 'plan');
const merged = parentPlan && legPrice(c, parentPlan, leg) != null && Math.abs(legPrice(c, parentPlan, leg) - (c.dragPrice?.[`order:${o.id}:${leg}`] ?? base)) < 0.005;
if (merged) head.push({ text: 'PLAN', color: '#d1d4dc', bg: 'rgba(120,123,134,0.35)', chip: true, plan: leg === 'entry' });
const gd = c.groupDelta && c.groupDelta.entryKeys.has(id) && leg === 'entry' ? c.groupDelta.delta : null;
if (gd != null) head.push({ text: ` ${gd >= 0 ? '+' : '−'}${Math.abs(gd).toFixed(2)} `, color: '#0b1d2b', bg: '#ffd166', chip: true });
const bad = isDragged(c, o, leg, id) && wrongSide(o, leg, price, legPrice(c, o, 'entry'));
head.push(legHead(leg, bad));
head.push(leg === 'entry' && o.status !== 'Filled' && o.status !== 'Closed'
? { text: `${short} ×${v.qty} ▾`, color: '#e1e4ea', bold: true, pick: true }
: { text: `${short} ×${v.qty}`, color: '#e1e4ea', bold: true });
if (leg === 'entry') {
if (o.trigger) head.push({ text: ` ⚡${o.trigger.op}${o.trigger.price}`, color: '#ffd166', bold: true });
head.push({ text: ` ${st.label} `, color: st.text, bg: st.color, chip: true });
if (o.sim && o.sent) head.push({ text: ' 模擬 ', color: '#2b2205', bg: '#ffd166', chip: true });
if (o.status === 'Filled') head.push({ text: ' $', color: T.up, bold: true });
if (!c.compact && !UNSENT.has(o.status)) {
head.push(rightChip(rightOf(o), ready));
head.push(ready ? { text: ' 送出 ', color: '#ffffff', bg: 'rgba(59,130,246,0.9)', chip: true, act: 'send' }
: { text: ' 撤單 ', color: '#ffffff', bg: 'rgba(239,83,80,0.85)', chip: true, act: 'cancel' });
} else if (!c.compact) head.push(rightChip(rightOf(o), false));
if (!c.compact && !['Cancelled', 'ApiCancelled', 'Rejected', 'Closed'].includes(o.status)) {
if (o.tp == null) head.push({ text: 'TP', color: '#0b1d17', bg: 'rgba(38,166,154,0.9)', chip: true, handle: 'tp' });
if (o.sl == null) head.push({ text: 'SL', color: '#2b2205', bg: 'rgba(242,201,76,0.9)', chip: true, handle: 'sl' });
}
}
const lockedEntry = leg === 'entry' && ['Filled', 'Cancelled', 'ApiCancelled', 'Rejected', 'Closed'].includes(o.status);
if (!lockedEntry) head.push({ text: '  ⋮⋮', color: '#b2b5be', grip: true });
lines.push(head);
if (o.status === 'Closed') {
if (leg === 'entry') lines.push([{ text: `@${o.fill_spot ?? price} 進 ${o.entry?.toFixed(2) ?? '—'} → 出 ${o.exit_premium?.toFixed(2) ?? '—'}  `, color: '#e1e4ea' },
{ text: o.realized != null ? signed(o.realized) : '—', color: pnlColor({ usd: o.realized ?? 0 }), bold: true }]);
else lines.push([{ text: `@${price.toFixed(2)}${o.exit_reason === leg ? '  ← 出場' : ''}`, color: o.exit_reason === leg ? (leg === 'tp' ? T.up : T.down) : T.muted, bold: o.exit_reason === leg }]);
} else if (!c.compact) {
const pred = v.predicted == null ? [{ text: `@${price.toFixed(2)} → —`, color: T.muted }] : [
{ text: `@${price.toFixed(2)} → ${v.predicted.toFixed(2)}${v.est ? '' : '  '}`, color: '#e1e4ea' },
...(v.unlisted ? [{ text: '合約不存在', color: '#ffffff', bg: '#ef5350', chip: true }, { text: ' ', color: '#e1e4ea' }] : v.est ? [{ text: '估', color: '#2b2205', bg: 'rgba(255,209,102,0.85)', chip: true }, { text: ' ', color: '#e1e4ea' }] : []),
{ text: v.predPnl ? signed(v.predPnl.usd) : '—', color: pnlColor(v.predPnl) },
];
lines.push(pred);
if (leg === 'entry' && hot) {
lines.push([{ text: '現價 ', color: T.muted }, { text: v.byLast ? signed(v.byLast.usd) : '—', color: pnlColor(v.byLast) },
{ text: ' / ', color: T.muted }, { text: v.byBid ? signed(v.byBid.usd) : '—', color: pnlColor(v.byBid) }]);
}
}
let shown = lines;
if (!bracketOpen(c, o.id)) {
const right = /C\d{8}\./.test(o.option) ? 'C' : 'P';
if (leg === 'tp' || leg === 'sl') {
const p = v.predPnl?.usd;
shown = [[{ text: `${LEG[leg].name} `, color: LEG[leg].color, bold: true }, { text: p == null ? '—' : signed(p).replace('-', '−'), color: pnlColor(v.predPnl), bold: true }]];
if (merged) shown[0].unshift({ text: 'P', color: '#d1d4dc', bg: 'rgba(120,123,134,0.35)', chip: true });
} else if (o.status === 'Filled') {
shown = [[{ text: 'Entry ', color: LEG.entry.color, bold: true }, { text: `${right} `, color: '#e1e4ea', bold: true },
{ text: v.byLast ? signed(v.byLast.usd).replace('-', '−') : '—', color: pnlColor(v.byLast), bold: true }]];
} else {
const last = c.spot ?? c.bars.at(-1)?.close; // p1.44: live IBKR underlying when fresh
const d = last != null ? price - last : null;
shown = [[{ text: `Entry ${short.replace(/^\d+(\.\d+)?/, (m) => m)} `, color: LEG.entry.color, bold: true },
{ text: d == null ? '' : `${d >= 0 ? '▲' : '▼'}${Math.abs(d).toFixed(2)}`, color: '#e1e4ea' }]];
if (o.trigger) shown[0].push({ text: ' ⚡', color: '#ffd166', bold: true });
if (merged) shown[0].unshift({ text: 'P', color: '#d1d4dc', bg: 'rgba(120,123,134,0.35)', chip: true, plan: true });
}
}
const pulseColor = o.status === 'Filled' ? (v0.byLast && v0.byLast.usd < -0.5 ? T.down : v0.byLast && v0.byLast.usd > 0.5 ? T.up : '#e1e4ea') : null;
items.push({ id, orderId: o.id, group: groupOf(o), leg, price, lines: shown, color: LEG[leg].color, hot, statusColor: st.color, pulseColor,
dash: leg === 'entry' && o.trigger ? [3, 3] : leg === 'entry' ? [] : [6, 4], urgent: st.urgent && leg === 'entry', ...(bad ? { color: '#ef5350' } : {}) });
}
}
for (const sg of c.signals) {
if (sg.rule.type !== 'price_target') continue;
const color = sg.author === 'agent' ? T.agent : T.human;
const id = `signal:${sg.id}`;
items.push({ id, price: sg.rule.price, lines: [[{ text: `⚑ ${sg.name}`, color: '#e1e4ea' }]], color, hot: c.hot === id, dash: [2, 4] });
}
return items;
}
const LINE_H = 15, PAD_Y = 3;
function drawLevels(ctx, c, bounding, yAxis) {
const items = levelItems(c).map((it) => ({ ...it, y: yAxis.convertToPixel(it.price) }))
.filter((it) => it.y > -20 && it.y < bounding.height + 20).sort((a, b) => a.y - b.y);
c.levelHits = [];
const zone = c.creating || (c.hot && c.dragPrice?.[c.hot] != null && /:(tp|sl)$/.test(c.hot) ? { orderId: c.hot.split(':')[1], leg: c.hot.split(':')[2], price: c.dragPrice[c.hot] } : null);
if (zone) {
const o = c.orders.find((x) => x.id === zone.orderId);
if (o) {
let gain;
if (o.kind === 'plan') gain = (rightOf(o) === 'P' ? -1 : 1) * (zone.price - o.linePrice);
else {
const ve = orderView(o, c.quotes[o.option], o.linePrice), vz = orderView(o, c.quotes[o.option], zone.price);
gain = ve.predicted != null && vz.predicted != null ? vz.predicted - ve.predicted : 0;
}
const y0 = yAxis.convertToPixel(o.linePrice), y1 = yAxis.convertToPixel(zone.price);
ctx.fillStyle = gain >= 0 ? 'rgba(38,166,154,0.12)' : 'rgba(255,152,0,0.14)';
ctx.fillRect(0, Math.min(y0, y1), bounding.width, Math.abs(y1 - y0));
}
}
const fg = focusGroup(c);
const alphaOf = (it) => (it.group == null ? (it.hot ? 1 : LEVEL_ALPHA) : fg == null ? (it.plan ? 0.6 : LEVEL_ALPHA) : it.group === fg ? 1 : 0.2);
const locked = !!c.lockedGroup && c.lockedGroup === fg;
const breath = 0.5 - 0.5 * Math.cos((performance.now() % 1800) / 1800 * Math.PI * 2);
const glowBlur = locked ? 5 + 11 * breath : 3 + 7 * breath;
c.pulsing = fg != null && items.some((it) => it.group === fg);
for (const it of items) {
const focused = it.group != null && it.group === fg;
const pulse = it.pulseColor;
if (pulse) c.pulsing = true;
ctx.globalAlpha = alphaOf(it);
ctx.strokeStyle = it.color; ctx.lineWidth = focused ? (locked ? 2.5 : 2) : pulse ? 1.5 : 1; ctx.setLineDash(it.dash);
if (focused) { ctx.shadowColor = it.color; ctx.shadowBlur = glowBlur; }
if (pulse) { ctx.shadowColor = pulse; ctx.shadowBlur = Math.max(focused ? glowBlur : 0, 3 + 11 * breath); }
ctx.beginPath(); ctx.moveTo(0, it.y); ctx.lineTo(bounding.width, it.y); ctx.stroke();
if (focused || pulse) { ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; }
}
ctx.setLineDash([]);
ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
const minTop = c.titleH ?? 50;
const maxBot = bounding.height - (c.eventRowH ?? 30) - (c.showBarNo && !c.compact ? 30 : 0) - 4;
const lab = items.map((it) => ({ it, h: it.lines.length * LINE_H + PAD_Y * 2, pinned: fg != null && it.group === fg }));
for (const L of lab) L.top = Math.min(Math.max(L.it.y - L.h / 2, minTop), maxBot - L.h);
for (let pass = 0; pass < 60; pass++) {
let moved = false;
lab.sort((a, b) => a.top - b.top);
for (let i = 1; i < lab.length; i++) {
const a = lab[i - 1], b = lab[i];
const over = a.top + a.h + LABEL_GAP - b.top;
if (over <= 0.5) continue;
moved = true;
if (a.pinned && !b.pinned) b.top += over;
else if (b.pinned && !a.pinned) a.top -= over;
else { a.top -= over / 2; b.top += over / 2; }
}
for (const L of lab) L.top = Math.min(Math.max(L.top, minTop), maxBot - L.h);
if (!moved) break;
}
const tops = new Map(lab.map((L) => [L.it, L.top]));
for (const it of items) {
const h = it.lines.length * LINE_H + PAD_Y * 2;
const top = tops.get(it);
const widths = it.lines.map((ln) => ln.reduce((w, seg) => {
ctx.font = `${seg.bold || seg.chip ? '600 ' : ''}11px sans-serif`;
return w + ctx.measureText(seg.text).width + (seg.chip ? 6 : 0);
}, 0));
const CLOSE = 14;
const w = Math.max(...widths) + 16 + CLOSE + 6;
const A = alphaOf(it);
ctx.globalAlpha = A;
ctx.beginPath();
if (it.plan) {
const tip = Math.min(10, h / 2), x0 = 4, x1 = 4 + w;
ctx.moveTo(x0 + 3, top); ctx.lineTo(x1, top); ctx.lineTo(x1 + tip, top + h / 2); ctx.lineTo(x1, top + h);
ctx.lineTo(x0 + 3, top + h); ctx.quadraticCurveTo(x0, top + h, x0, top + h - 3); ctx.lineTo(x0, top + 3);
ctx.quadraticCurveTo(x0, top, x0 + 3, top); ctx.closePath();
} else if (ctx.roundRect) ctx.roundRect(4, top, w, h, 4); else ctx.rect(4, top, w, h);
const glow = it.group != null && it.group === fg;
const glowColor = it.leg === 'entry' && it.statusColor ? it.statusColor : it.color;
const frame = (strokeStyle, width, dash) => {
const fBlur = locked ? 4 + 8 * breath : 2 + 6 * breath;
if (glow) { ctx.shadowColor = glowColor; ctx.shadowBlur = fBlur; }
if (it.pulseColor) { ctx.shadowColor = it.pulseColor; ctx.shadowBlur = Math.max(glow ? fBlur : 0, 2 + 9 * breath); }
ctx.setLineDash(dash || []); ctx.strokeStyle = it.pulseColor || (glow ? glowColor : strokeStyle); ctx.lineWidth = width; ctx.stroke(); ctx.setLineDash([]);
ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
};
if (it.plan) {
frame('rgba(178,181,190,0.8)', 1, [3, 3]); // plan shell: dashed frame, no fill
} else {
ctx.fillStyle = glow ? 'rgba(30,34,45,0.92)' : 'rgba(30,34,45,0.7)';
ctx.fill();
frame(it.urgent ? T.down : 'rgba(120,123,134,0.6)', it.urgent ? 2 : 1);
ctx.fillStyle = glowColor; ctx.fillRect(4, top + 2, 3, h - 4);
}
const cx1 = 4 + w - 3, cx0 = cx1 - CLOSE, cy0 = top + 2;
ctx.fillStyle = 'rgba(120,123,134,0.18)';
ctx.fillRect(cx0, cy0, CLOSE, CLOSE);
ctx.strokeStyle = '#b2b5be'; ctx.lineWidth = 1.2;
ctx.beginPath(); ctx.moveTo(cx0 + 4, cy0 + 4); ctx.lineTo(cx1 - 4, cy0 + CLOSE - 4); ctx.moveTo(cx1 - 4, cy0 + 4); ctx.lineTo(cx0 + 4, cy0 + CLOSE - 4); ctx.stroke();
const cornerClose = { x0: cx0, x1: cx1, y0: cy0, y1: cy0 + CLOSE };
if (Math.abs(top + h / 2 - it.y) > 1) {
ctx.strokeStyle = it.color; ctx.beginPath(); ctx.moveTo(4 + w, top + h / 2); ctx.lineTo(4 + w + 8, it.y); ctx.stroke();
}
ctx.globalAlpha = A;
let closeBox = null, planBox = null, pickBox = null, gripBox = null;
const handles = [], acts = [];
it.lines.forEach((ln, r) => {
let x = 12;
const ly = top + PAD_Y + LINE_H * r + LINE_H / 2 + 0.5;
for (const seg of ln) {
ctx.font = `${seg.bold || seg.chip ? '600 ' : ''}11px sans-serif`;
const tw = ctx.measureText(seg.text).width;
if (seg.chip) {
if (seg.handle) handles.push({ leg: seg.handle, x0: x + 2, x1: x + tw + 4, y0: ly - 7, y1: ly + 7 });
if (seg.plan) planBox = { x0: x + 2, x1: x + tw + 4, y0: ly - 7, y1: ly + 7 };
if (seg.act) acts.push({ act: seg.act, x0: x + 2, x1: x + tw + 4, y0: ly - 7, y1: ly + 7 });
ctx.fillStyle = seg.bg;
ctx.beginPath();
if (ctx.roundRect) ctx.roundRect(x + 2, ly - 7, tw + 2, 14, 3); else ctx.rect(x + 2, ly - 7, tw + 2, 14);
ctx.fill();
ctx.fillStyle = seg.color; ctx.fillText(seg.text, x + 3, ly);
x += tw + 6;
continue;
}
ctx.fillStyle = seg.color;
ctx.fillText(seg.text, x, ly);
if (seg.close) closeBox = { x0: x + 4, x1: x + tw + 4, y0: ly - 8, y1: ly + 8 };
if (seg.pick) pickBox = { x0: x, x1: x + tw, y0: ly - 8, y1: ly + 8 };
if (seg.grip) gripBox = { x0: x + 2, x1: x + tw + 3, y0: ly - 8, y1: ly + 8 };
x += tw;
}
});
c.levelHits.push({ id: it.id, orderId: it.orderId, group: it.group, leg: it.leg, close: cornerClose, handles, acts, planBox, pickBox, gripBox, plan: it.plan, x0: 4, x1: 4 + w, y0: top, y1: top + h, lineY: it.y });
}
ctx.globalAlpha = 1;
}
function orderFigures({ coordinates, bounding }) {
const y = coordinates[0].y;
return [{ type: 'line', attrs: { coordinates: [{ x: 0, y }, { x: bounding.width, y }] }, styles: { color: 'rgba(0,0,0,0)', size: 6 } }];
}
function registerAll(k, metas) {
if (!registered) {
registered = true;
k.registerIndicator({
name: '__SYS', shortName: '', series: 'price', figures: [], calcParams: [],
styles: { tooltip: { showRule: 'none' } },
calc: (list) => list.map(() => ({})), draw: sysDraw,
});
k.registerOverlay({
name: 'orderLine', totalStep: 2, needDefaultPointFigure: false,
needDefaultXAxisFigure: false, needDefaultYAxisFigure: false, createPointFigures: orderFigures,
});
}
for (const m of metas) k.registerIndicator(templateFor(m));
}
function createCanvasChart(k, el, { metas, interactive = true, onOrderMove, onOrderRemove, onPlanOpen, onContextMenu, onContractPick, compact = false, legendOpen = {}, legendCollapsed = true } = {}) {
const WD = ['日', '一', '二', '三', '四', '五', '六'];
const wdFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' });
const WD_EN = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const weekday = (ts) => `(${WD[WD_EN[wdFmt.format(new Date(ts))]]})`;
let barNoAt = () => null;
const formatDate = ({ dateTimeFormat, timestamp, template, type }) => {
const base = k.utils.formatDate(dateTimeFormat, timestamp, template);
if (type === 'crosshair') {
const m = /^(\d{4}-\d{2}-\d{2})(.*)$/.exec(base);
const n = barNoAt(timestamp);
return (m ? `${m[1]} ${weekday(timestamp)}${m[2]}` : base) + (n ? `  #${n}` : '');
}
if (type === 'xAxis' && template === 'MM-DD') return `${base} ${weekday(timestamp)}`;
return base;
};
const chart = k.init(el, { timezone: TZ, styles: chartStyles(), formatter: { formatDate } });
const OHLC = [
{ title: 'Time: ', value: '{time}' }, { title: 'Open: ', value: '{open}' }, { title: 'High: ', value: '{high}' },
{ title: 'Low: ', value: '{low}' }, { title: 'Close: ', value: '{close}' }, { title: 'Volume: ', value: '{volume}' },
];
let collapsed = legendCollapsed;
let onLegendFold = null;
const ctx = { tf: 'M5', bars: [], barNo: [], notes: [], fills: [], signals: [], orders: [], drawings: [], quotes: {}, hot: null, dragPrice: {}, levelHits: [], showBarNo: true, compact, legendOpen: { ...legendOpen }, rows: {} };
barNoAt = (ts) => { const i = barIndexAt(ctx.bars, ts); return i >= 0 && ctx.bars[i].timestamp === ts ? ctx.barNo[i]?.n ?? null : null; };
const updateTitleH = () => {
const rows = collapsed ? 0 : 2 + chart.getIndicators({ paneId: CANDLE }).filter((i) => i.name !== '__SYS').length;
ctx.titleH = 50 + rows * 20;
};
const applyFold = () => {
updateTitleH();
chart.setStyles({
candle: { tooltip: {
legend: { template: collapsed ? [] : OHLC },
features: [{ ...COLLAPSE, id: 'fold', position: 'left', marginLeft: 2, marginTop: 3, size: 12,
content: { family: 'sans-serif', code: collapsed ? '▸' : '▾' } }],
} },
indicator: { tooltip: { showRule: collapsed ? 'none' : (compact ? 'follow_cross' : 'always') } },
});
};
applyFold();
chart.subscribeAction('onCandleTooltipFeatureClick', (info) => {
if (info?.feature?.id !== 'fold') return;
collapsed = !collapsed;
applyFold();
onLegendFold?.(collapsed);
});
chart.overrideYAxis({
paneId: CANDLE, gap: { top: 0.08, bottom: compact ? 52 : 84 },
createRange: ({ chart: ch, defaultRange }) => {
const list = ch.getDataList();
const { from, to } = ch.getVisibleRange();
let lo = Infinity, hi = -Infinity;
for (let i = Math.max(0, from); i < Math.min(to, list.length); i++) {
if (list[i].low < lo) lo = list[i].low;
if (list[i].high > hi) hi = list[i].high;
}
if (!(hi > lo)) return defaultRange;
const r = hi - lo;
return { from: lo, to: hi, range: r, realFrom: lo, realTo: hi, realRange: r, displayFrom: lo, displayTo: hi, displayRange: r };
},
});
chart.createIndicator({ name: '__SYS', paneId: CANDLE, zLevel: 10 }, true);
CTX.set(chart.id, ctx);
const active = new Map(); // indicator name -> paneId
let dragging = false;
let onLegendToggle = null;
let onEye = null;
chart.subscribeAction('onIndicatorTooltipFeatureClick', (info) => {
if (info?.feature?.id === 'eye') { onEye?.(info.indicator.name); return; }
if (info?.feature?.id !== 'collapse') return;
const name = info.indicator.name;
ctx.legendOpen[name] = !ctx.legendOpen[name];
chart.overrideIndicator({ name, extendData: { ...info.indicator.extendData } });
onLegendToggle?.(name, ctx.legendOpen[name]);
});
const redraw = () => chart.overrideIndicator({ name: '__SYS', paneId: CANDLE, calcParams: [Date.now() % 1e6] });
const pulseTimer = interactive ? setInterval(() => { if (ctx.pulsing && !dragging) redraw(); }, 50) : null;
chart.subscribeAction('onCrosshairChange', (cr) => {
if (dragging || cr?.x == null || cr.y == null) return;
const hit = ctx.levelHits.find((h) => cr.x >= h.x0 && cr.x <= h.x1 && cr.y >= h.y0 && cr.y <= h.y1);
const id = hit?.id ?? null;
if (id !== ctx.hot) {
const before = focusGroup(ctx);
ctx.hot = id; redraw();
const after = focusGroup(ctx);
if (after !== before) onFocusChange?.(after, !!ctx.lockedGroup);
}
});
if (interactive) {
const paneDom = () => chart.getDom(CANDLE, 'main');
const setCursor = (kind) => {
for (const k of ['grab', 'grabbing', 'pointer', 'default', 'move']) el.classList.toggle(`tc-cursor-${k}`, k === kind);
};
const local = (e) => { const r = paneDom().getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
const orderAt = (p) => {
const ord = ctx.levelHits.filter((h) => h.id.startsWith('order:'));
return ord.find((h) => p.x >= h.x0 && p.x <= h.x1 && p.y >= h.y0 && p.y <= h.y1);
};
el.addEventListener('contextmenu', (e) => {
const p = local(e);
const r = paneDom().getBoundingClientRect();
if (p.y < 0 || p.y > r.height) return; // candle pane only
e.preventDefault();
const price = chart.convertFromPixel([{ x: p.x, y: p.y }], { paneId: CANDLE })[0]?.value;
if (price != null) onContextMenu?.(price, { x: e.clientX, y: e.clientY });
});
el.addEventListener('mousemove', (e) => {
if (dragging) return;
const p = local(e), h = orderAt(p);
const hd = h?.handles?.find((x) => p.x >= x.x0 && p.x <= x.x1 && p.y >= x.y0 && p.y <= x.y1);
el.title = hd ? (hd.leg === 'tp' ? 'Drag to add Take profit' : 'Drag to add Stop loss') : '';
const onPlan = h?.planBox && p.x >= h.planBox.x0 && p.x <= h.planBox.x1 && p.y >= h.planBox.y0 && p.y <= h.planBox.y1;
if (onPlan) el.title = '開啟計畫卡片';
const inBox = (b) => b && p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1;
const onGrip = inBox(h?.gripBox);
if (onGrip) el.title = e.shiftKey ? 'Shift：整組移動' : '拖曳改價（Shift：整組移動）';
const act = h?.acts?.find(inBox);
if (act) el.title = act.act === 'flip' ? '切換 Call / Put（TP、SL 對調）' : act.act === 'send' ? '送出（先看 dry-run 預覽）' : '撤單（先看 dry-run 預覽）';
setCursor(onGrip && e.shiftKey ? 'move' : onGrip || hd ? 'grab' : act || onPlan || inBox(h?.close) || inBox(h?.pickBox) ? 'pointer' : h ? 'default' : '');
});
const pointAt = (p) => {
const r = chart.convertFromPixel([{ x: p.x, y: p.y }], { paneId: CANDLE })[0] || {};
const data = chart.getDataList(), step = (PERIODS[ctx.tf]?.min || 5) * 60000;
if (!data.length || r.value == null) return null;
const i = Math.round(r.dataIndex ?? 0);
const ts = i < 0 ? data[0].timestamp + i * step : i >= data.length ? data.at(-1).timestamp + (i - data.length + 1) * step : data[i].timestamp;
return { ts, price: Math.round(r.value * 100) / 100 };
};
el.addEventListener('mousemove', (e) => {
const p = local(e);
if (ctx.drawMode && ctx.drawDraft) {
const q = pointAt(p);
if (q) { ctx.drawDraft.anchors = [...ctx.drawDraft.fixed, q]; redraw(); }
setCursor('pointer');
return;
}
if (ctx.dragDraw) return;
const h = !dragging && drawingAt(ctx, p);
if (h) { setCursor(h.anchor != null ? 'grab' : 'pointer'); el.title = h.anchor != null ? '拖曳移動這個點' : '點一下選取（Delete 刪除，雙擊改標題）'; }
});
el.addEventListener('mousedown', (e) => {
if (e.button !== 0) return;
const p = local(e);
if (orderAt(p)) return; // order labels keep priority
if (ctx.drawMode) {
e.stopImmediatePropagation(); e.preventDefault();
const q = pointAt(p);
if (!q) return;
const kind = ctx.drawMode, need = DRAW_KINDS[kind];
ctx.drawDraft ||= { kind, fixed: [], anchors: [], created_by: { kind: 'human' } };
ctx.drawDraft.fixed.push(q); ctx.drawDraft.anchors = [...ctx.drawDraft.fixed];
if (ctx.drawDraft.fixed.length >= need) {
const done = { kind, anchors: ctx.drawDraft.fixed.map((a) => ({ ts: a.ts, price: a.price })) };
ctx.drawMode = null; ctx.drawDraft = null; setCursor(''); redraw();
onDrawingDone?.(done);
} else redraw();
return;
}
const h = drawingAt(ctx, p);
if (!h) { if (ctx.selectedDrawing) { ctx.selectedDrawing = null; redraw(); onDrawingSelect?.(null); } return; }
e.stopImmediatePropagation(); e.preventDefault();
if (ctx.selectedDrawing !== h.id) { ctx.selectedDrawing = h.id; redraw(); onDrawingSelect?.(h.id); }
if (h.anchor == null) return;
const d = ctx.drawings.find((x) => x.id === h.id);
if (!d) return;
const toPt = (a) => ({ ts: a.ts ?? Date.parse(a.time), price: a.price });
ctx.dragDraw = { id: d.id, anchors: d.anchors.map(toPt) };
let moved = false;
setCursor('grabbing');
const mv = (ev) => {
const q = pointAt(local(ev));
if (!q) return;
moved = true;
ctx.dragDraw.anchors = ctx.dragDraw.anchors.map((a, i) => (i === h.anchor ? q : a));
redraw();
};
const up = () => {
document.removeEventListener('mousemove', mv, true); document.removeEventListener('mouseup', up, true);
const anchors = ctx.dragDraw.anchors;
ctx.dragDraw = null; setCursor('');
if (moved) { d.anchors = anchors.map((a) => ({ ts: a.ts, price: a.price })); onDrawingChange?.(d.id, d.anchors); }
redraw();
};
document.addEventListener('mousemove', mv, true); document.addEventListener('mouseup', up, true);
}, true);
el.addEventListener('dblclick', (e) => {
const h = drawingAt(ctx, local(e));
if (h) { e.stopImmediatePropagation(); onDrawingEdit?.(h.id); }
}, true);
el.addEventListener('mousedown', (e) => {
if (e.button !== 0) return;
const start = local(e);
const eh = ctx.edgeHit;
if (eh && start.x >= eh.x0 && start.x <= eh.x1 && start.y >= eh.y0 && start.y <= eh.y1) { e.stopPropagation(); onEdgeRetry?.(); return; }
const hit = orderAt(start);
if (!hit) {
if (ctx.lockedGroup) { ctx.lockedGroup = null; redraw(); onFocusChange?.(focusGroup(ctx), false); } // empty click releases
return;
}
e.stopPropagation(); e.preventDefault();
if (hit.close && start.x >= hit.close.x0 && start.x <= hit.close.x1 && start.y >= hit.close.y0 && start.y <= hit.close.y1) {
onOrderRemove?.(hit.orderId, hit.leg);
return;
}
const act = hit.acts?.find((b) => start.x >= b.x0 && start.x <= b.x1 && start.y >= b.y0 && start.y <= b.y1);
if (act) {
const r = paneDom().getBoundingClientRect();
onTradeAction?.(act.act, hit.orderId, { x: r.left + act.x0, y: r.top + hit.y1 + 4 });
return;
}
if (hit.pickBox && start.x >= hit.pickBox.x0 && start.x <= hit.pickBox.x1 && start.y >= hit.pickBox.y0 && start.y <= hit.pickBox.y1) {
const r = paneDom().getBoundingClientRect();
onContractPick?.(hit.orderId, { x: r.left + hit.pickBox.x0, y: r.top + hit.y1 + 4 });
return;
}
if (hit.planBox && start.x >= hit.planBox.x0 && start.x <= hit.planBox.x1 && start.y >= hit.planBox.y0 && start.y <= hit.planBox.y1) {
const r = paneDom().getBoundingClientRect();
const o = ctx.orders.find((x) => x.id === hit.orderId);
onPlanOpen?.(o?.kind === 'plan' ? o.id : (o?.from_plan || hit.orderId), { x: r.left + hit.x1 + 8, y: r.top + hit.y0 });
return;
}
const handle = hit.handles?.find((hd) => start.x >= hd.x0 && start.x <= hd.x1 && start.y >= hd.y0 && start.y <= hd.y1);
if (handle) {
dragging = true;
const priceAt = (y) => chart.convertFromPixel([{ x: 10, y }], { paneId: CANDLE })[0].value;
ctx.creating = { orderId: hit.orderId, leg: handle.leg, price: priceAt(start.y) };
ctx.hot = `order:${hit.orderId}:${handle.leg}`;
const move = (ev) => { ctx.creating.price = priceAt(local(ev).y); redraw(); onLegDrag?.(hit.orderId, handle.leg, ctx.creating.price); };
const up = (ev) => {
document.removeEventListener('mousemove', move, true);
document.removeEventListener('mouseup', up, true);
const price = priceAt(local(ev).y);
const leg = ctx.creating.leg;
dragging = false; ctx.creating = null; ctx.hot = null;
const o = ctx.orders.find((x) => x.id === hit.orderId);
if (o && Math.abs(local(ev).y - hit.lineY) > 6 && !wrongSide(o, leg, price)) { o[leg] = price; onOrderMove?.(hit.orderId, price, leg); }
redraw();
};
document.addEventListener('mousemove', move, true);
document.addEventListener('mouseup', up, true);
redraw();
return;
}
ctx.lockedGroup = hit.group || groupOf(ctx.orders.find((x) => x.id === hit.orderId)); onFocusChange?.(ctx.lockedGroup, true);
const g = hit.gripBox;
if (!(g && start.x >= g.x0 && start.x <= g.x1 && start.y >= g.y0 && start.y <= g.y1)) { redraw(); return; }
setCursor('grabbing');
const DRAG_PX = 4;
const offset = start.y - hit.lineY; // keep the grab point under the cursor when grabbing the label
let moving = false;
const priceAt = (y) => chart.convertFromPixel([{ x: 10, y: y - offset }], { paneId: CANDLE })[0].value;
const grabbed = ctx.orders.find((x) => x.id === hit.orderId);
const FROZEN = new Set(['Filled', 'Cancelled', 'ApiCancelled', 'Rejected', 'Inactive', 'Closed']);
if (e.shiftKey && grabbed && !(grabbed.kind !== 'plan' && FROZEN.has(grabbed.status))) {
const gid = groupOf(grabbed);
const legs = [];
for (const o of ctx.orders) {
if (groupOf(o) !== gid || (o.kind !== 'plan' && FROZEN.has(o.status))) continue;
for (const leg of ['entry', 'tp', 'sl']) {
const p0 = leg === 'entry' ? o.linePrice : o[leg];
if (p0 != null) legs.push({ o, leg, p0, key: `order:${o.id}:${leg}` });
}
}
const base = hit.leg === 'entry' ? grabbed.linePrice : grabbed[hit.leg];
let delta = 0, gMoving = false;
const cancel = () => { for (const l of legs) delete ctx.dragPrice[l.key]; ctx.groupDelta = null; dragging = false; redraw(); };
const gMove = (ev) => {
const y = local(ev).y;
if (!gMoving) {
if (Math.abs(y - start.y) <= DRAG_PX) return;
gMoving = true; dragging = true; ctx.hot = hit.id; setCursor('grabbing');
}
delta = Math.round((priceAt(y) - base) * 100) / 100;
for (const l of legs) ctx.dragPrice[l.key] = l.p0 + delta;
ctx.groupDelta = { gid, delta, entryKeys: new Set(legs.filter((l) => l.leg === 'entry').map((l) => l.key)) };
redraw();
};
const gEnd = () => {
document.removeEventListener('mousemove', gMove, true);
document.removeEventListener('mouseup', gUp, true);
document.removeEventListener('keydown', gKey, true);
setCursor('');
};
const gKey = (ev) => { if (ev.key === 'Escape') { ev.stopPropagation(); gEnd(); cancel(); } };
const gUp = () => {
gEnd();
if (!gMoving || !delta) { cancel(); return; }
for (const l of legs) { if (l.leg === 'entry') l.o.linePrice = l.p0 + delta; else l.o[l.leg] = l.p0 + delta; }
cancel();
onGroupMove?.(gid, delta, [...new Set(legs.map((l) => l.o.id))]);
};
document.addEventListener('mousemove', gMove, true);
document.addEventListener('mouseup', gUp, true);
document.addEventListener('keydown', gKey, true);
return;
}
const move = (ev) => {
const y = local(ev).y;
if (!moving) {
if (Math.abs(y - start.y) <= DRAG_PX) return;
moving = true; dragging = true; ctx.hot = hit.id;
}
ctx.dragPrice[hit.id] = priceAt(y); redraw(); onLegDrag?.(hit.orderId, hit.leg, ctx.dragPrice[hit.id]);
};
const up = (ev) => {
document.removeEventListener('mousemove', move, true);
document.removeEventListener('mouseup', up, true);
setCursor('');
if (!moving) { redraw(); return; }
const price = priceAt(local(ev).y);
dragging = false; ctx.hot = null; delete ctx.dragPrice[hit.id];
const o = ctx.orders.find((x) => x.id === hit.orderId);
if (o && wrongSide(o, hit.leg, price)) { redraw(); return; } // snap back
if (o) { if (hit.leg === 'entry') o.linePrice = price; else o[hit.leg] = price; }
redraw();
onOrderMove?.(hit.orderId, price, hit.leg);
};
document.addEventListener('mousemove', move, true);
document.addEventListener('mouseup', up, true);
}, true);
}
function fitSubPanes() {
const subs = [...active].filter(([name]) => metas.find((x) => x.name === name)?.pane !== 'main');
if (!subs.length) return;
const shown = subs.filter(([name, paneId]) => chart.getIndicators({ name, paneId })[0]?.visible);
const hiddenH = (subs.length - shown.length) * 24;
const budget = el.clientHeight * 0.5 - 28 - hiddenH; // 28: x-axis
const each = shown.length ? Math.max(24, Math.min(compact ? 70 : 110, Math.floor(budget / shown.length))) : 24;
for (const [name, paneId] of subs) {
const on = shown.some(([n]) => n === name);
chart.setPaneOptions({ id: paneId, height: on ? each : 24, minHeight: 24 });
}
}
if (typeof ResizeObserver !== 'undefined' && interactive) new ResizeObserver(() => fitSubPanes()).observe(el);
let vpRaf = 0, onVisibleChange = null, onLegDrag = null, onFocusChange = null, onEdgeRetry = null, onGroupMove = null, onTradeAction = null,
onDrawingDone = null, onDrawingChange = null, onDrawingSelect = null, onDrawingEdit = null;
chart.subscribeAction('onVisibleRangeChange', () => {
if (vpRaf) return;
const raf = globalThis.requestAnimationFrame || ((f) => setTimeout(f, 16)); // Node (headless snapshot) has no rAF
vpRaf = raf(() => { vpRaf = 0; onVisibleChange?.(); });
});
const api = {
chart, ctx,
set onVisibleChange(fn) { onVisibleChange = fn; },
set onLegDrag(fn) { onLegDrag = fn; },
set onFocusChange(fn) { onFocusChange = fn; },
set onEdgeRetry(fn) { onEdgeRetry = fn; },
set onGroupMove(fn) { onGroupMove = fn; },
set onTradeAction(fn) { onTradeAction = fn; },
set onDrawingDone(fn) { onDrawingDone = fn; },
set onDrawingChange(fn) { onDrawingChange = fn; },
set onDrawingSelect(fn) { onDrawingSelect = fn; },
set onDrawingEdit(fn) { onDrawingEdit = fn; },
startDraw(kind) { ctx.drawMode = kind || null; ctx.drawDraft = null; ctx.selectedDrawing = null; redraw(); },
get drawMode() { return ctx.drawMode || null; },
get selectedDrawing() { return ctx.selectedDrawing || null; },
selectDrawing(id) { ctx.selectedDrawing = id; redraw(); },
redraw: () => redraw(),
setReplayCursor(ts) { if (ctx.replayTs !== ts) { ctx.replayTs = ts; redraw(); } },
setFocus(gid, lock) { if (lock !== undefined) ctx.lockedGroup = lock ? gid : null; ctx.treeFocus = lock === undefined ? gid : null; redraw(); },
setVp(index, opts, lowerTf) {
ctx.vp = { index, opts, lowerTf, version: (ctx.vp?.version || 0) + 1, key: null };
chart.overrideIndicator({ name: 'VRVP', paneId: CANDLE, calcParams: [ctx.vp.version] });
},
get dragging() { return dragging; },
set onLegendToggle(fn) { onLegendToggle = fn; },
set onEye(fn) { onEye = fn; },
set onLegendFold(fn) { onLegendFold = fn; },
setBars(symbol, tf, bars, loadOlder) {
ctx.tf = tf; ctx.bars = bars; ctx.barNo = barNumbers(bars, tf);
ctx.rows = {};
for (const [name, paneId] of active) chart.removeIndicator({ name, paneId });
active.clear();
const p = PERIODS[tf];
chart.setSymbol({ ticker: symbol, pricePrecision: 2, volumePrecision: 0 });
chart.setPeriod({ type: p.type, span: p.span });
chart.setDataLoader({
getBars: async ({ type, callback }) => {
if (type === 'init') return callback(bars, { forward: !!loadOlder, backward: false });
if (type !== 'forward' || !loadOlder) return callback([], false);
ctx.loadingOlder = true; redraw();
const older = await loadOlder().catch(() => null);
ctx.loadingOlder = false;
if (!older) return callback([], { forward: true, backward: false }); // failed: allow retry
if (older.length) { ctx.bars = [...older, ...ctx.bars]; ctx.barNo = barNumbers(ctx.bars, tf); }
callback(older, { forward: older.done !== true, backward: false });
},
});
},
get loadingOlder() { return !!ctx.loadingOlder; },
setRows(rows) {
ctx.rows = rows;
for (const [name] of active) chart.overrideIndicator({ name, extendData: { rows: rows[name] || [] } });
},
apply(state, visible, quotes = {}) {
let sq = null;
for (const q of Object.values(quotes)) if (q && !q.sim && !q.est && q.source === 'IBKR' && q.underlying_price > 0 && Date.now() - q.at < 60000 && (!sq || q.at > sq.at)) sq = q;
ctx.spot = sq ? sq.underlying_price : null;
for (const m of [...metas].sort((a, b) => a.order - b.order)) {
if (!ctx.rows[m.name]) continue;
const on = visible.has(`indicators/${m.name}`);
const paneId = m.pane === 'main' ? CANDLE : `pane_${m.name}`;
if (m.pane !== 'main' && !on) {
if (active.has(m.name)) { chart.removeIndicator({ name: m.name, paneId }); active.delete(m.name); }
continue;
}
if (!active.has(m.name)) {
chart.createIndicator({ name: m.name, paneId, visible: on, zLevel: m.zLevel ?? 0, extendData: { rows: ctx.rows[m.name] } }, true);
active.set(m.name, paneId);
} else {
const ind = chart.getIndicators({ name: m.name, paneId })[0];
if (ind && ind.visible !== on) chart.overrideIndicator({ name: m.name, paneId, visible: on });
}
}
fitSubPanes();
updateTitleH();
ctx.showBarNo = visible.has('system/bar-number');
ctx.notes = (state.notes || []).filter((n) => visible.has(n.path));
ctx.fills = (state.fills || []).filter((f) => visible.has(f.path));
ctx.signals = (state.signals || []).filter((s) => visible.has(s.path));
ctx.drawings = (state.drawings || []).filter((d) => d.path && visible.has(d.path));
if (ctx.selectedDrawing && !ctx.drawings.some((d) => d.id === ctx.selectedDrawing)) ctx.selectedDrawing = null;
ctx.orders = state.orders || [];
ctx.reviewFocus = state.reviewFocus ?? null;
ctx.state = state;
ctx.visibleLegs = new Set([...visible].filter((p) => /\/(entry|tp|sl)$/.test(p)));
ctx.quotes = quotes;
chart.overrideIndicator({ name: '__SYS', paneId: CANDLE, calcParams: [Date.now() % 1e6] });
},
activeIndicators: () => [...active.keys()],
destroy() { clearInterval(pulseTimer); CTX.delete(chart.id); k.dispose(el); },
};
return api;
}
function syncCrosshairs(views) {
for (const src of views) {
src.chart.subscribeAction('onCrosshairChange', (cr) => {
if (!cr || cr.x == null) return;
const paneId = cr.paneId || CANDLE;
const pt = src.chart.convertFromPixel([{ x: cr.x, y: cr.y }], { paneId })[0];
const bar = src.chart.getDataList()[pt?.dataIndex];
if (!bar) return;
const price = paneId === CANDLE ? pt.value : null;
for (const dst of views) {
if (dst === src) continue;
const list = dst.chart.getDataList();
const i = barIndexAt(list, bar.timestamp);
if (i < 0) continue;
const px = dst.chart.convertToPixel({ dataIndex: i, value: price ?? list[i].close }, { paneId: CANDLE });
dst.chart.executeAction('onCrosshairChange', { x: px.x, y: price == null ? -1 : px.y, paneId: CANDLE });
}
});
}
}
return { EVENT_KINDS, eventsByBar, wrongSide, registerAll, createCanvasChart, syncCrosshairs };
})();
__M['public/core/wire.js'] = (() => {
function unpackBars(r) {
return r.bars.map(([timestamp, open, high, low, close, volume]) => ({ timestamp, open, high, low, close, volume }));
}
function unpackRows(packed, n) {
const rows = Array.from({ length: n }, () => ({}));
packed.keys.forEach((k, j) => {
const col = packed.cols[j];
for (let i = 0; i < n; i++) if (col[i] != null) rows[i][k] = col[i];
});
for (const { i, ...rest } of packed.extra) Object.assign(rows[i], rest);
return rows;
}
return { unpackBars, unpackRows };
})();
__M['indicators/gap.js'] = (() => {
const MIN_TICK = 0.01;
const MIN_PCT = 0.0005;
const META = {
name: 'GAP', label: 'Gaps (unfilled)', paramsText: '≥0.05%', pane: 'main', order: 2, defaultOn: true, zLevel: -1,
plot: { custom: 'gaps' },
};
function compute(bars) {
const intraday = bars.length > 1 && bars[1].timestamp - bars[0].timestamp < 864e5;
let open = [];
const rows = [];
for (let i = 0; i < bars.length; i++) {
const b = bars[i], p = bars[i - 1];
open = open.map((g) => {
let { top, bottom } = g;
if (g.dir === 'up') top = Math.min(top, Math.max(bottom, b.low)); // price came down into it from above
else bottom = Math.max(bottom, Math.min(top, b.high));            // price came up into it from below
return { ...g, top, bottom };
}).filter((g) => g.top - g.bottom >= MIN_TICK / 2);
if (p) {
const min = Math.max(MIN_TICK, intraday ? b.close * MIN_PCT : 0);
if (b.low - p.high >= min) open.push({ start: b.timestamp, dir: 'up', top: b.low, bottom: p.high, top0: b.low, bottom0: p.high });
else if (p.low - b.high >= min) open.push({ start: b.timestamp, dir: 'down', top: p.low, bottom: b.high, top0: p.low, bottom0: b.high });
}
rows.push({ gaps: open, n: open.length });
}
return rows;
}
function describe(row) {
if (!row) return null;
return {
open: (row.gaps || []).map((g) => ({
start_ms: g.start, dir: g.dir, top: +g.top.toFixed(2), bottom: +g.bottom.toFixed(2),
filled_pct: Math.round((1 - (g.top - g.bottom) / (g.top0 - g.bottom0)) * 100),
})),
};
}
return { MIN_TICK, MIN_PCT, META, compute, describe };
})();
__M['indicators/_util.js'] = (() => {
function sma(values, n) {
const out = new Array(values.length).fill(null);
let sum = 0;
for (let i = 0; i < values.length; i++) {
sum += values[i];
if (i >= n) sum -= values[i - n];
if (i >= n - 1) out[i] = sum / n;
}
return out;
}
function ema(values, n) {
const out = new Array(values.length).fill(null);
let start = values.findIndex((v) => v != null);
if (start < 0 || values.length - start < n) return out;
let v = 0;
for (let i = start; i < start + n; i++) v += values[i];
v /= n;
out[start + n - 1] = v;
const k = 2 / (n + 1);
for (let i = start + n; i < values.length; i++) { v = values[i] * k + v * (1 - k); out[i] = v; }
return out;
}
function rowsFrom(len, series) {
const rows = [];
for (let i = 0; i < len; i++) {
const r = {};
for (const [key, arr] of Object.entries(series)) if (arr[i] != null && Number.isFinite(arr[i])) r[key] = arr[i];
rows.push(r);
}
return rows;
}
return { sma, ema, rowsFrom };
})();
__M['indicators/vol.js'] = (() => {
const { sma, rowsFrom } = __M['indicators/_util.js'];
const META = {
name: 'VOL', label: 'Volume (MA5,10)', paramsText: '5,10', pane: 'main', order: 3, defaultOn: true, zLevel: -1,
plot: { custom: 'volOverlay' },
};
function compute(bars) {
const vol = bars.map((b) => b.volume || 0);
const rows = rowsFrom(bars.length, { vol, ma5: sma(vol, 5), ma10: sma(vol, 10) });
bars.forEach((b, i) => { rows[i].up = b.close >= b.open ? 1 : 0; });
return rows;
}
function describe(row) {
if (row?.ma10 == null) return null;
return { vol: row.vol, above_ma5: row.vol > row.ma5, above_ma10: row.vol > row.ma10, ratio_ma10: row.vol / row.ma10 };
}
return { META, compute, describe };
})();
__M['indicators/vrvp.js'] = (() => {
const META = {
name: 'VRVP', label: 'VRVP (visible range)', paramsText: 'rows · VA%', pane: 'main', order: 5, defaultOn: true,
zLevel: -1, plot: { custom: 'vrvp' },
};
function compute(bars) {
return bars.map(() => ({}));
}
return { META, compute };
})();
__M['indicators/ma.js'] = (() => {
const { sma, rowsFrom } = __M['indicators/_util.js'];
const PERIODS = [5, 10, 20, 60];
const COLORS = ['#f7c548', '#e040fb', '#29b6f6', '#90a4ae'];
const META = {
name: 'MA', label: 'MA (5,10,20,60)', paramsText: PERIODS.join(','), pane: 'main', order: 10, defaultOn: true, zLevel: -1,
plot: { lines: PERIODS.map((p, i) => ({ key: `ma${p}`, title: `MA${p}`, color: COLORS[i] })) },
};
function compute(bars) {
const close = bars.map((b) => b.close);
return rowsFrom(bars.length, Object.fromEntries(PERIODS.map((p) => [`ma${p}`, sma(close, p)])));
}
function describe(row, _prev, bar) {
const vals = PERIODS.map((p) => row?.[`ma${p}`]).filter((v) => v != null);
if (!vals.length) return null;
return { close_above_all: vals.every((v) => bar.close > v), close_below_all: vals.every((v) => bar.close < v) };
}
return { META, compute, describe };
})();
__M['indicators/vwap.js'] = (() => {
const { etParts } = __M['public/core/time.js'];
const META = {
name: 'VWAP', label: 'VWAP (session)', paramsText: 'RTH 09:30', pane: 'main', order: 15, defaultOn: true, zLevel: -1,
plot: { lines: [{ key: 'vwap', title: 'VWAP', color: '#e1e4ea', width: 1.5 }] },
};
function compute(bars) {
const rows = [];
let day = null, pv = 0, vol = 0;
const intraday = bars.length < 2 || bars[1].timestamp - bars[0].timestamp < 864e5;
for (const b of bars) {
if (!intraday) { rows.push({}); continue; }
const e = etParts(b.timestamp);
if (e.dateKey !== day) { day = e.dateKey; pv = 0; vol = 0; }
const v = b.volume || 0;
pv += ((b.high + b.low + b.close) / 3) * v;
vol += v;
rows.push(vol > 0 ? { vwap: pv / vol } : {});
}
return rows;
}
function describe(row, _prev, bar) {
if (row?.vwap == null) return null;
return { close_vs_vwap: bar.close > row.vwap ? 'above' : bar.close < row.vwap ? 'below' : 'at', distance: bar.close - row.vwap };
}
return { META, compute, describe };
})();
__M['indicators/boll.js'] = (() => {
const { sma, rowsFrom } = __M['indicators/_util.js'];
const N = 20, K = 2;
const META = {
name: 'BOLL', label: 'BOLL (20,2)', paramsText: '20,2', pane: 'main', order: 20, defaultOn: false, zLevel: -1,
plot: { lines: [
{ key: 'up', title: 'UP', color: '#2962ff' }, { key: 'mid', title: 'MID', color: '#ff9800' }, { key: 'dn', title: 'DN', color: '#2962ff' },
] },
};
function compute(bars) {
const close = bars.map((b) => b.close);
const mid = sma(close, N);
const up = [], dn = [];
for (let i = 0; i < close.length; i++) {
if (mid[i] == null) { up.push(null); dn.push(null); continue; }
let s = 0;
for (let j = i - N + 1; j <= i; j++) s += (close[j] - mid[i]) ** 2;
const md = Math.sqrt(s / N);
up.push(mid[i] + K * md); dn.push(mid[i] - K * md);
}
return rowsFrom(bars.length, { up, mid, dn });
}
function describe(row, _prev, bar) {
if (row?.up == null) return null;
const width = row.up - row.dn;
return { position: width > 0 ? (bar.close - row.dn) / width : null, width };
}
return { META, compute, describe };
})();
__M['indicators/macd.js'] = (() => {
const { ema, rowsFrom } = __M['indicators/_util.js'];
const FAST = 12, SLOW = 26, SIG = 9;
const META = {
name: 'MACD', label: 'MACD (12,26,9)', paramsText: '12,26,9', pane: 'sub', order: 30, defaultOn: true, precision: 4,
plot: {
lines: [{ key: 'dif', title: 'DIF', color: '#2962ff' }, { key: 'dea', title: 'DEA', color: '#ff9800' }],
hist: [{ key: 'macd', title: 'MACD' }],
},
};
function compute(bars) {
const close = bars.map((b) => b.close);
const f = ema(close, FAST), s = ema(close, SLOW);
const dif = close.map((_, i) => (f[i] != null && s[i] != null ? f[i] - s[i] : null));
const dea = ema(dif, SIG);
const macd = dif.map((d, i) => (d != null && dea[i] != null ? (d - dea[i]) * 2 : null));
return rowsFrom(bars.length, { dif, dea, macd });
}
function describe(row, prev) {
if (row?.dea == null) return null;
let cross = null;
if (prev?.dea != null) {
if (prev.dif <= prev.dea && row.dif > row.dea) cross = 'golden';
else if (prev.dif >= prev.dea && row.dif < row.dea) cross = 'dead';
}
return { dif_above_dea: row.dif > row.dea, hist_rising: prev?.macd != null ? row.macd > prev.macd : null, cross };
}
return { META, compute, describe };
})();
__M['indicators/kdj.js'] = (() => {
const { rowsFrom } = __M['indicators/_util.js'];
const N = 9, M1 = 3, M2 = 3;
const META = {
name: 'KDJ', label: 'KDJ (9,3,3)', paramsText: '9,3,3', pane: 'sub', order: 40, defaultOn: false,
plot: { lines: [{ key: 'k', title: 'K', color: '#ff9800' }, { key: 'd', title: 'D', color: '#2962ff' }, { key: 'j', title: 'J', color: '#e040fb' }] },
};
function compute(bars) {
const K = [], D = [], J = [];
for (let i = 0; i < bars.length; i++) {
if (i < N - 1) { K.push(null); D.push(null); J.push(null); continue; }
let hi = -Infinity, lo = Infinity;
for (let j = i - N + 1; j <= i; j++) { hi = Math.max(hi, bars[j].high); lo = Math.min(lo, bars[j].low); }
const rsv = ((bars[i].close - lo) / (hi - lo || 1)) * 100;
const k = ((M1 - 1) * (K[i - 1] ?? 50) + rsv) / M1;
const d = ((M2 - 1) * (D[i - 1] ?? 50) + k) / M2;
K.push(k); D.push(d); J.push(3 * k - 2 * d);
}
return rowsFrom(bars.length, { k: K, d: D, j: J });
}
function describe(row) {
if (row?.k == null) return null;
return { zone: row.k > 80 ? 'overbought' : row.k < 20 ? 'oversold' : 'neutral', k_above_d: row.k > row.d };
}
return { META, compute, describe };
})();
__M['indicators/gmma.js'] = (() => {
const { ema, rowsFrom } = __M['indicators/_util.js'];
const GROUPS = [
{ id: 'short', label: '短', periods: [3, 5, 8, 10, 12, 15], rgb: [38, 166, 154], alpha: [0.30, 0.70] },   // green
{ id: 'long', label: '長', periods: [30, 35, 40, 45, 50, 60], rgb: [242, 201, 76], alpha: [0.30, 0.70] }, // yellow
{ id: 'far', label: '遠', periods: [120, 150, 180, 200], rgb: [171, 71, 188], alpha: [0.25, 0.48] },     // purple
{ id: 'ultra', label: '超遠', periods: [250, 300], rgb: [171, 71, 188], alpha: [0.55, 0.70] },           // purple
];
const ANCHOR = { period: 20, color: 'rgba(239,83,80,0.6)', width: 2.5, dash: [6, 4] };
const SQUEEZE_PCT = 0.0015;
function colour(g, i) {
const t = i / Math.max(g.periods.length - 1, 1);
const a = g.alpha[0] + t * (g.alpha[1] - g.alpha[0]);
return `rgba(${g.rgb.join(',')},${a.toFixed(3)})`;
}
const PLOT_GROUPS = ['long', 'far', 'ultra'];
const META = {
name: 'GMMA', label: `GMMA (${GROUPS.map((g) => `${g.periods[0]}-${g.periods.at(-1)}`).join(' / ')})`,
paramsText: GROUPS.map((g) => g.periods.join(',')).join(' | '), pane: 'main', order: 50, defaultOn: true, zLevel: -1,
plot: { lines: [
...GROUPS.filter((g) => PLOT_GROUPS.includes(g.id)).flatMap((g) => g.periods.map((p, i) => ({ key: `ema${p}`, title: `${p}`, color: colour(g, i), width: 1, smooth: true }))),
{ key: `ema${ANCHOR.period}`, title: `EMA${ANCHOR.period}`, color: ANCHOR.color, width: ANCHOR.width, dash: ANCHOR.dash, smooth: true },
] },
warmup: Math.max(...GROUPS.flatMap((g) => g.periods)) * 3,
};
function compute(bars) {
const close = bars.map((b) => b.close);
const series = {};
for (const g of GROUPS) for (const p of g.periods) series[`ema${p}`] = ema(close, p);
series[`ema${ANCHOR.period}`] = ema(close, ANCHOR.period);
return rowsFrom(bars.length, series);
}
function groupState(row, g, close) {
const v = g.periods.map((p) => row[`ema${p}`]);
if (v.some((x) => x == null)) return null;
const lo = Math.min(...v), hi = Math.max(...v);
const desc = v.every((x, i) => i === 0 || v[i - 1] >= x);
const asc = v.every((x, i) => i === 0 || v[i - 1] <= x);
return { min: lo, max: hi, spread: hi - lo, spread_pct: (hi - lo) / close, squeeze: (hi - lo) / close < SQUEEZE_PCT,
order: desc ? 'fanned_up' : asc ? 'fanned_down' : 'tangled' };
}
function describe(row, prev, bar) {
if (!row) return null;
const groups = {};
for (const g of GROUPS) groups[g.id] = groupState(row, g, bar.close);
const relation = {};
for (let i = 0; i + 1 < GROUPS.length; i++) {
const a = groups[GROUPS[i].id], b = groups[GROUPS[i + 1].id];
if (!a || !b) continue;
relation[`${GROUPS[i].id}_vs_${GROUPS[i + 1].id}`] = a.min > b.max ? 'above' : a.max < b.min ? 'below' : 'mixed';
}
if (prev) {
for (const g of GROUPS) {
const p = groupState(prev, g, bar.close);
if (p && groups[g.id]) groups[g.id].spread_change = groups[g.id].spread - p.spread;
}
}
return { groups, relation, squeeze_pct_threshold: SQUEEZE_PCT };
}
return { GROUPS, ANCHOR, SQUEEZE_PCT, PLOT_GROUPS, META, compute, describe };
})();
__M['card/indicators.js'] = (() => {
const { META: GAP_M, compute: gap } = __M['indicators/gap.js'];
const { META: VOL_M, compute: vol } = __M['indicators/vol.js'];
const { META: VRVP_M, compute: vrvp } = __M['indicators/vrvp.js'];
const { META: MA_M, compute: ma } = __M['indicators/ma.js'];
const { META: VWAP_M, compute: vwap } = __M['indicators/vwap.js'];
const { META: BOLL_M, compute: boll } = __M['indicators/boll.js'];
const { META: MACD_M, compute: macd } = __M['indicators/macd.js'];
const { META: KDJ_M, compute: kdj } = __M['indicators/kdj.js'];
const { META: GMMA_M, compute: gmma } = __M['indicators/gmma.js'];
const COMPUTE = Object.fromEntries([[GAP_M, gap], [VOL_M, vol], [VRVP_M, vrvp], [MA_M, ma], [VWAP_M, vwap],
[BOLL_M, boll], [MACD_M, macd], [KDJ_M, kdj], [GMMA_M, gmma]].map(([m, f]) => [m.name, f]));
return { COMPUTE };
})();
__M['card/shell.js'] = (() => {
const { registerAll, createCanvasChart } = __M['public/core/chart.js'];
const { T } = __M['public/core/theme.js'];
const { leaves, shown } = __M['public/core/layers.js'];
const { barNumbers } = __M['public/core/time.js'];
const { unpackRows } = __M['public/core/wire.js'];
const { COMPUTE } = __M['card/indicators.js'];
const KLINE = 'https://cdn.jsdelivr.net/npm/klinecharts@10.1.0/dist/umd/klinecharts.min.js';
const GROUPS = [
{ id: 'indicators', label: '指標', re: /^indicators\// }, { id: 'human', label: 'human', re: /^human\// },
{ id: 'agent', label: 'agent', re: /^agent\// }, { id: 'signals', label: 'signals', re: /\/signal\// },
{ id: 'notes', label: 'notes', re: /\/note\// }, { id: 'drawings', label: '畫線', re: /\/drawing\// },
];
const TOOLS = [['select', '▤ 選 bar', '點一根 bar，或按住拖一段範圍'], ['trend_line', '╱ 趨勢線', '草稿：點 2 下'], ['horizontal_line', '─ 水平線', '草稿：點 1 下']];
const CSS = `
.kc{font:12px/1.4 var(--font-sans,ui-sans-serif,system-ui,sans-serif);color:var(--foreground,#d1d4dc);min-height:700px}
.kc *{box-sizing:border-box}
.kc-row{display:flex;flex-wrap:wrap;gap:4px 6px;align-items:center;margin-bottom:6px}
.kc-title{color:var(--muted-foreground,#787b86);margin-right:2px}
.kc-btn{font:inherit;padding:2px 8px;border-radius:4px;border:1px solid var(--border,#2a2e39);background:transparent;color:inherit;cursor:pointer}
.kc-btn.on{background:var(--chart-1,#2962ff);border-color:var(--chart-1,#2962ff);color:var(--primary-foreground,#fff)}
.kc-btn.off{opacity:.45;text-decoration:line-through}
.kc-sep{width:1px;height:16px;background:var(--border,#2a2e39)}
.kc-chart{position:relative;width:100%;height:460px;border:1px solid var(--border,#2a2e39);border-radius:6px;overflow:hidden}
.kc-note{width:100%;font:inherit;color:inherit;background:transparent;border:1px solid var(--border,#2a2e39);border-radius:4px;padding:4px 6px;resize:vertical;min-height:30px}
.kc-btn:disabled{opacity:.45;cursor:default}
.kc-lines{margin:0 0 6px;font-size:11px}
.kc-lines summary{cursor:pointer;color:var(--muted-foreground,#787b86);user-select:none}
.kc-list{max-height:120px;overflow:auto;border:1px solid var(--border,#2a2e39);border-radius:4px;padding:2px 4px;margin-top:4px}
.kc-grp{color:var(--muted-foreground,#787b86);margin-top:2px}
.kc-li{display:flex;gap:6px;align-items:center;min-width:0}
.kc-li .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer}
.kc-li.sel .nm{text-decoration:underline}.kc-li.del .nm{text-decoration:line-through;opacity:.6}
.kc-eye{font:inherit;border:0;background:transparent;color:inherit;cursor:pointer;padding:0 2px;width:20px}
.kc-send{font-weight:600}
.kc-msg{color:var(--muted-foreground,#787b86);font-size:11px;min-height:15px}
.kc-msg.err{color:var(--destructive,#ef5350)}
.kc-foot{margin-top:6px;color:var(--muted-foreground,#787b86);font-size:11px;display:flex;flex-wrap:wrap;gap:4px 12px}
.kc-err{padding:12px;color:var(--destructive,#ef5350);white-space:pre-wrap;word-break:break-all}
.kc .tc-cursor-pointer,.kc .tc-cursor-pointer *{cursor:pointer!important}
.kc .tc-cursor-grab,.kc .tc-cursor-grab *{cursor:grab!important}
.kc .tc-cursor-grabbing,.kc .tc-cursor-grabbing *{cursor:grabbing!important}
.kc-tabs{display:flex;gap:4px;overflow-x:auto;white-space:nowrap;margin-bottom:4px;scrollbar-width:thin}
.kc-tab{max-width:150px;overflow:hidden;text-overflow:ellipsis;flex:0 0 auto}
.kc-tab.miss::after{content:' ⚠'}
.kc-miss{color:var(--warning,#f2c94c);font-size:11px;margin-bottom:4px}
@media (max-width:480px){.kc{min-height:720px}.kc-chart{height:380px}.kc-tab{max-width:120px}}`;
function loadKline() {
if (window.klinecharts) return Promise.resolve(window.klinecharts);
window.__kcardKline ||= new Promise((ok, fail) => {
const s = document.createElement('script');
s.src = KLINE; s.onload = () => ok(window.klinecharts); s.onerror = () => fail(new Error(`KLineChart 載入失敗：${KLINE}`));
document.head.appendChild(s);
});
return window.__kcardKline;
}
function applyTheme() {
const probe = document.createElement('canvas').getContext('2d');
const css = getComputedStyle(document.documentElement);
const cv = (name, fb) => {
const raw = css.getPropertyValue(name).trim();
if (!raw) return fb;
for (const c of [raw, `hsl(${raw})`]) { probe.fillStyle = '#010203'; probe.fillStyle = c; if (probe.fillStyle !== '#010203') return c; }
return fb;
};
Object.assign(T, {
bg: cv('--background', T.bg), panel: cv('--card', cv('--popover', T.panel)), border: cv('--border', T.border), grid: cv('--border', T.grid),
text: cv('--foreground', T.text), muted: cv('--muted-foreground', T.muted), human: cv('--chart-1', T.human), agent: cv('--chart-4', T.agent), noteRow: cv('--card', T.noteRow),
});
}
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
async function boot(script) {
let cfg = null;
let prev = script?.previousElementSibling;
while (prev && !(prev.tagName === 'SCRIPT' && prev.type === 'text/kcard')) prev = prev.previousElementSibling;
try { cfg = JSON.parse((prev || document.querySelector('script[type="text/kcard"]'))?.textContent || 'null'); } catch { cfg = null; }
if (!document.getElementById('kc-css')) { const st = el('style'); st.id = 'kc-css'; st.textContent = CSS; document.head.appendChild(st); }
const root = el('div', 'kc');
if (script && document.body?.contains(script)) script.parentNode.insertBefore(root, script.nextSibling);
else if (document.body) document.body.appendChild(root);
else await new Promise((ok) => document.addEventListener('DOMContentLoaded', () => { document.body.appendChild(root); ok(); }, { once: true }));
const fail = (msg) => { root.innerHTML = ''; root.appendChild(el('div', 'kc-err', msg)); };
if (!cfg?.src || !cfg?.id) return fail('kcard：找不到設定，需要 <script type="text/kcard">{"src":"…","id":"…"}</script>');
const src = String(cfg.src).replace(/\/+$/, '');
const api = async (path, init) => {
const url = `${src}${path}`;
let r;
try { r = await fetch(url, init); } catch (e) { throw new Error(`連不到 ${url}\n${e.message}`); }
const j = await r.json().catch(() => ({}));
if (!r.ok) throw Object.assign(new Error(`${url} 回 ${r.status}：${j.error || r.statusText}`), { status: r.status, body: j });
return j;
};
root.appendChild(el('div', 'kc-msg', `載入中 ${src}/api/card/${cfg.id} …`));
let data, k;
try { [data, k] = await Promise.all([api(`/api/card/${encodeURIComponent(cfg.id)}`), loadKline()]); } catch (e) { return fail(`kcard 載入失敗\n${e.message}`); }
applyTheme();
root.innerHTML = '';
const tabsRow = el('div', 'kc-tabs'), head = el('div', 'kc-row'), tools = el('div', 'kc-row'), missEl = el('div', 'kc-miss'), chartEl = el('div', 'kc-chart');
const linesBox = el('details', 'kc-lines'), linesSum = el('summary'), linesList = el('div', 'kc-list');
linesBox.append(linesSum, linesList);
const noteEl = el('textarea', 'kc-note'); noteEl.rows = 1; noteEl.placeholder = '備註（一則，送出時一起帶給 agent）';
const bottom = el('div', 'kc-row'), msg = el('div', 'kc-msg'), foot = el('div', 'kc-foot');
root.append(tabsRow, head, tools, linesBox, missEl, chartEl, noteEl, bottom, msg, foot);
const say = (t, err) => { msg.textContent = t || ''; msg.classList.toggle('err', !!err); };
foot.append(el('span', null, data.title), el('span', null, `資料：${data.source}`), el('span', null, `快照於 ${data.frozen_at}`), el('span', null, `畫線 revision ${data.base_revision}`), el('span', null, `卡片 ${data.id}`));
const shared = data.drawings.map((d) => ({ ...d, anchors: d.anchors.map((a) => ({ ...a })) }));
const panes = data.panes.map((p, idx) => {
const id = p.id || p.tf || `p${idx + 1}`;
const all = p.bars.map((b) => ({ timestamp: b[0], open: b[1], high: b[2], low: b[3], close: b[4], volume: b[5] }));
const bars = all.slice(p.warm);
const rows = {};
for (const m of data.metas) {
if (COMPUTE[m.name]) { try { rows[m.name] = COMPUTE[m.name](all).slice(p.warm); } catch { /* skip */ } }
else if (p.rows?.[m.name]) rows[m.name] = unpackRows(p.rows[m.name], bars.length);
}
const hidden = new Set();
if (p.focus === 'temp') for (const d of shared) hidden.add(d.id);
else if (Array.isArray(p.focus)) for (const d of shared) if (!p.focus.includes(d.id)) hidden.add(d.id);
return { id, tf: p.tf, label: p.label || p.tf, missing: p.missing || null, bars, rows, nums: barNumbers(bars, p.tf),
temp: (p.temp || []).map((d) => ({ ...d })), drafts: [], hidden, pendingDel: new Set(), selection: null };
});
const state = { symbol: data.symbol, notes: data.notes, signals: data.signals, drawings: [], intakeCleaners: data.intakeCleaners || [], fills: [], orders: [] };
registerAll(k, data.metas);
const view = createCanvasChart(k, chartEl, { metas: data.metas, interactive: true, legendCollapsed: true });
const offGroups = {};
let cur = 0, mode = null, locked = false, sent = null, selLine = null, draftSeq = 0;
const P = () => panes[cur];
const visible = () => {
const off = GROUPS.filter((g) => offGroups[g.id]);
return new Set(leaves(state, data.metas).map((l) => l.path).filter((p) => p.startsWith('card/') || (shown(p, data.off) && !off.some((g) => g.re.test(p)))));
};
const daily = (p) => p.bars.length > 1 && p.bars[1].timestamp - p.bars[0].timestamp >= 864e5 * 0.9;
const dateOf = (ts) => new Date(ts).toLocaleDateString('sv-SE', { timeZone: 'America/New_York' });
const selBand = (p) => {
const s0 = p.selection;
if (!s0) return [];
const a = p.bars[s0.i0], b = p.bars[s0.i1];
if (!a || !b) return [];
const lab = daily(p) ? (s0.i0 === s0.i1 ? dateOf(a.timestamp).slice(5) : `${dateOf(a.timestamp).slice(5)}～${dateOf(b.timestamp).slice(5)}`)
: s0.i0 === s0.i1 ? `#${p.nums[s0.i0]?.n ?? '?'}` : `#${p.nums[s0.i0]?.n ?? '?'}–#${p.nums[s0.i1]?.n ?? '?'}`;
return [{ id: 'sel', kind: 'bar_span', path: `card/${p.id}/sel`, created_by: { kind: 'human' }, color: 'rgba(255,209,102,0.9)', label: lab,
anchors: [{ ts: a.timestamp, price: 0 }, { ts: b.timestamp, price: 0 }] }];
};
const kindOf = (d) => d.kind === 'trend_line' ? '趨勢線' : d.kind === 'horizontal_line' ? '水平線' : d.kind === 'parallel_channel' ? '通道' : d.kind === 'marker' ? '標記' : d.kind === 'zone' ? '區間' : d.kind;
const groupOfLine = (p, id) => (p.temp.some((d) => d.id === id) ? 'temp' : p.drafts.some((d) => d.id === id) ? 'draft' : 'shared');
const totals = () => ({ drafts: panes.reduce((n, p) => n + p.drafts.length, 0), deletes: panes.reduce((n, p) => n + p.pendingDel.size, 0), selections: panes.filter((p) => p.selection).length });
const refresh = () => {
const p = P();
const lines = [...shared.map((d) => (p.pendingDel.has(d.id) ? { ...d, pending_delete: true } : d)), ...p.temp, ...p.drafts].filter((d) => !p.hidden.has(d.id));
state.drawings = [...lines, ...selBand(p)];
view.apply(state, visible(), {});
if (selLine && (p.hidden.has(selLine) || ![...shared, ...p.temp, ...p.drafts].some((d) => d.id === selLine))) { selLine = null; view.selectDrawing(null); }
const t = totals();
Object.assign(root.dataset, { pane: p.id, drafts: t.drafts, selection: t.selections, hidden: p.hidden.size, deletes: t.deletes, line: selLine || '', ready: '1' });
missEl.textContent = p.missing ? `這個分頁的資料不完整：要 ${p.missing.asked}，cache 裡只有 ${p.missing.have || '（沒有）'}。沒有觸發下載。` : '';
renderLines();
};
function renderLines() {
const p = P();
const n = p.temp.length + p.drafts.length + shared.length;
linesSum.textContent = `線 ${n} 條${p.hidden.size ? `（隱藏 ${p.hidden.size}）` : ''}${p.pendingDel.size ? ` · 待刪 ${p.pendingDel.size}` : ''}`;
linesList.innerHTML = '';
for (const [name, list] of [['暫時（agent）', p.temp], ['草稿', p.drafts], ['共用', shared]]) {
if (!list.length) continue;
linesList.appendChild(el('div', 'kc-grp', name));
for (const d of list) {
const row = el('div', `kc-li${selLine === d.id ? ' sel' : ''}${p.pendingDel.has(d.id) ? ' del' : ''}`);
const eye = el('button', 'kc-eye', p.hidden.has(d.id) ? '◌' : '●'); eye.title = p.hidden.has(d.id) ? '顯示' : '隱藏';
eye.onclick = () => { if (p.hidden.has(d.id)) p.hidden.delete(d.id); else p.hidden.add(d.id); refresh(); };
const who = d.created_by?.kind === 'agent' ? ` · ${d.created_by.name}` : '';
const nm = el('span', 'nm', `${kindOf(d)}${d.label ? `「${d.label}」` : ''}${who}`); nm.title = d.id;
nm.onclick = () => { if (p.hidden.has(d.id)) return; selLine = d.id; view.selectDrawing(d.id); refresh(); renderTools(); };
row.append(eye, nm);
if (p.pendingDel.has(d.id) && !locked) { const undo = el('button', 'kc-eye', '↺'); undo.title = '復原'; undo.style.width = 'auto'; undo.onclick = () => { p.pendingDel.delete(d.id); refresh(); renderTools(); }; row.appendChild(undo); }
linesList.appendChild(row);
}
}
}
function deleteSelected() {
const p = P();
if (locked || !selLine) return;
const g = groupOfLine(p, selLine);
if (g === 'temp') return say('agent 的暫時線不能刪，可以在「線」清單裡隱藏。', true);
if (g === 'draft') { p.drafts.splice(p.drafts.findIndex((d) => d.id === selLine), 1); selLine = null; say(''); }
else if (p.pendingDel.has(selLine)) { p.pendingDel.delete(selLine); say('已復原'); }
else { p.pendingDel.add(selLine); say('已標成待刪：送出後由 agent 確認才會真的刪。'); }
refresh(); renderTools();
}
const show = (i) => {
cur = i; selLine = null; setMode(null);
const p = P();
view.setBars(data.symbol, p.tf, p.bars);
view.setRows(p.rows);
refresh();
view.chart.setBarSpace(Math.max(3, (chartEl.clientWidth - 80) / Math.max(20, p.bars.length + 2)));
view.chart.scrollToRealTime();
renderHead(); renderTools();
};
function renderHead() {
tabsRow.innerHTML = '';
panes.forEach((p, i) => {
const b = el('button', `kc-btn kc-tab${i === cur ? ' on' : ''}${p.missing ? ' miss' : ''}`, p.label); b.title = `${p.label}（${p.tf}）${p.missing ? '：資料不完整' : ''}`;
b.onclick = () => show(i); tabsRow.appendChild(b);
});
head.innerHTML = '';
for (const g of GROUPS) {
const b = el('button', `kc-btn${offGroups[g.id] ? ' off' : ''}`, g.label); b.title = `顯示／隱藏 ${g.label}`;
b.onclick = () => { offGroups[g.id] = !offGroups[g.id]; refresh(); renderHead(); };
head.appendChild(b);
}
}
function setMode(m) {
mode = locked ? null : m;
view.startDraw(mode === 'trend_line' || mode === 'horizontal_line' ? mode : null);
renderTools();
say(mode === 'select' ? '點一根 bar，或按住左鍵左右拖一段範圍' : mode ? `草稿 ${mode === 'trend_line' ? '趨勢線：點 2 下' : '水平線：點 1 下'}，Esc 取消` : '');
}
function renderTools() {
const p = P();
tools.innerHTML = '';
for (const [m, label, title] of TOOLS) {
const b = el('button', `kc-btn${mode === m ? ' on' : ''}`, label); b.title = title; b.disabled = locked;
b.onclick = () => setMode(mode === m ? null : m); tools.appendChild(b);
}
tools.appendChild(el('span', 'kc-sep'));
const undo = el('button', 'kc-btn', '刪掉上一條'); undo.disabled = locked || !p.drafts.length; undo.onclick = () => { p.drafts.pop(); refresh(); renderTools(); };
const g = selLine && groupOfLine(p, selLine);
const del = el('button', 'kc-btn', g === 'shared' && p.pendingDel.has(selLine) ? '復原這條' : '刪掉這條');
del.disabled = locked || !selLine || g === 'temp'; del.title = g === 'temp' ? 'agent 的暫時線只能隱藏' : 'Delete 鍵也可以';
del.onclick = deleteSelected;
const clr = el('button', 'kc-btn', '清除選取'); clr.disabled = locked || !p.selection; clr.onclick = () => { p.selection = null; refresh(); renderTools(); };
tools.append(undo, del, clr);
bottom.innerHTML = '';
const t = totals();
const summary = el('span', 'kc-title', `選取 ${t.selections} · 草稿 ${t.drafts} 條${t.deletes ? ` · 待刪 ${t.deletes}` : ''}`);
const send = el('button', 'kc-btn on kc-send', sent ? `已送出 ${sent.sub_id}` : '送出'); send.disabled = locked;
send.onclick = submit;
bottom.append(summary, send);
if (sent?.hookFailed) { const again = el('button', 'kc-btn', '重送到 thread'); again.onclick = () => postHook(sent); bottom.appendChild(again); }
}
view.onDrawingDone = (d) => {
const p = P(); draftSeq += 1;
p.drafts.push({ ...d, id: `draft-${draftSeq}`, pane: p.id, card_draft: true, created_by: { kind: 'human' }, path: `card/${p.id}/draft/${draftSeq}` });
setMode(null); refresh();
};
view.onDrawingChange = (id, anchors) => {
const p = P(), d = p.drafts.find((x) => x.id === id);
if (d && !locked) d.anchors = anchors;
else {
const t = shared.find((x) => x.id === id), s0 = data.drawings.find((x) => x.id === id);
if (t && s0) t.anchors = s0.anchors.map((a) => ({ ...a }));
const tt = p.temp.find((x) => x.id === id), t0 = (data.panes[cur].temp || []).find((x) => x.id === id);
if (tt && t0) tt.anchors = t0.anchors.map((a) => ({ ...a }));
}
refresh();
};
view.onDrawingSelect = (id) => { selLine = id === 'sel' ? null : id; refresh(); renderTools(); };
const paneRect = () => view.chart.getDom('candle_pane', 'main').getBoundingClientRect();
const barIndex = (e) => {
const r = paneRect();
const pt = view.chart.convertFromPixel([{ x: e.clientX - r.left, y: e.clientY - r.top }], { paneId: 'candle_pane' })[0];
const n = P().bars.length;
return pt?.dataIndex == null ? null : Math.max(0, Math.min(n - 1, Math.round(pt.dataIndex)));
};
root.addEventListener('mousedown', (e) => {
if (mode !== 'select' || locked || e.button !== 0 || !chartEl.contains(e.target)) return;
const i0 = barIndex(e);
if (i0 == null) return;
e.stopImmediatePropagation(); e.preventDefault();
const p = P();
p.selection = { i0, i1: i0 }; refresh();
const mv = (ev) => { const i = barIndex(ev); if (i == null) return; p.selection = { i0: Math.min(i0, i), i1: Math.max(i0, i) }; refresh(); };
const up = () => { document.removeEventListener('mousemove', mv, true); document.removeEventListener('mouseup', up, true); renderTools(); };
document.addEventListener('mousemove', mv, true); document.addEventListener('mouseup', up, true);
}, true);
root.tabIndex = -1;
root.addEventListener('keydown', (e) => {
if (e.key === 'Escape' && mode) setMode(null);
if ((e.key === 'Delete' || e.key === 'Backspace') && selLine && !/^(TEXTAREA|INPUT)$/.test(e.target.tagName)) { e.preventDefault(); deleteSelected(); }
});
async function postHook(rec) {
try {
await fetch(cfg.hook, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ answer: rec.answer, sentAt: new Date().toISOString() }) });
rec.hookFailed = false; locked = true; setMode(null);
say(`已送出 ${rec.sub_id}，agent 會在 thread 收到。卡片已鎖定。`);
} catch (e) { rec.hookFailed = true; say(`紀錄 ${rec.sub_id} 已存，但送到 thread 失敗：${e.message}。草稿保留，可以重送。`, true); }
renderTools();
}
async function submit() {
if (locked) return;
const body = { base_revision: data.base_revision, note: noteEl.value.trim(),
selections: panes.filter((p) => p.selection).map((p) => ({ pane: p.id, from_ts: p.bars[p.selection.i0].timestamp, to_ts: p.bars[p.selection.i1].timestamp })),
drawings: panes.flatMap((p) => p.drafts.map((d) => ({ pane: p.id, kind: d.kind, anchors: d.anchors.map((a) => ({ ts: a.ts ?? Date.parse(a.time), price: a.price })) }))),
deletes: panes.flatMap((p) => [...p.pendingDel].map((id) => ({ drawing_id: id, pane: p.id, revision: data.base_revision }))) };
if (!body.selections.length && !body.drawings.length && !body.deletes.length && !body.note) return say('還沒有東西可以送：選 bar、畫草稿、標待刪，或寫備註。', true);
say('送出中…');
try {
const r = await api(`/api/card/${encodeURIComponent(cfg.id)}/submit`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify(body) });
sent = { sub_id: r.sub_id, answer: r.answer };
root.dataset.sub = r.sub_id;
if (cfg.hook) await postHook(sent);
else { locked = true; setMode(null); say(`已存紀錄 ${r.sub_id}（這張卡沒有 hook：agent 要從 /api/ai/submissions 讀）。卡片已鎖定。`); renderTools(); }
noteEl.disabled = locked;
renderLines();
} catch (e) { say(`送出失敗：${e.message}。草稿保留。`, true); }
}
show(0);
if (window.ResizeObserver) new ResizeObserver(() => view.chart.resize()).observe(chartEl);
}
boot(window.__kcardScript);
return {  };
})();
})();
