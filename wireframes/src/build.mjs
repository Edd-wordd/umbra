// Umbra lo-fi wireframe generator. Emits self-contained HTML frames (inline SVG/CSS).
// Usage: node build.mjs   -> writes ../*.html
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---------- tokens ----------
const C = {
  bg: '#060708', gridMinor: 'rgba(170,180,190,0.028)', gridMajor: 'rgba(170,180,190,0.055)',
  ink: '#aab1b9', mid: '#7d848c', dim: '#4a5058', ghost: '#2a2e33', line: '#1d2024', panel: '#08090b',
  cyan: '#3fe3ff', amber: '#ffb648', red: '#ff5252', note: '#7b8189',
};
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------- seeded rng ----------
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const R = mulberry32(20261005);

// ---------- graph data: nodes are real things (sample names) ----------
const nodes = []; const links = []; const byId = {};
function N(id, dom, kind, label) { const n = { id, dom, kind, label: label ?? id }; nodes.push(n); byId[id] = n; return n; }
function L(a, b) { if (a !== b && byId[a] && byId[b]) links.push({ s: a, t: b }); }
const doms = ['dev', 'lab', 'print', 'astro', 'biz', 'cam', 'know', 'life'];
doms.forEach(d => N('hub:' + d, d, 'hub', d.toUpperCase()));
// dev
['umbra', 'deadbridge-crm', 'parallax', 'homelab-iac', 'dotfiles'].forEach(r => { N('repo:' + r, 'dev', 'repo', r); L('hub:dev', 'repo:' + r); });
N('figma:console-v0', 'dev', 'design', 'figma: console v0'); L('hub:dev', 'figma:console-v0'); L('figma:console-v0', 'repo:umbra');
[['pr:142', 'umbra'], ['pr:138', 'umbra'], ['pr:57', 'deadbridge-crm']].forEach(([p, r]) => { N(p, 'dev', 'pr', p.replace('pr:', 'PR #')); L(p, 'repo:' + r); });
N('ci:umbra', 'dev', 'ci', 'ci: umbra ✓'); L('ci:umbra', 'repo:umbra');
N('ci:deadbridge', 'dev', 'ci', 'ci: deadbridge ✕'); L('ci:deadbridge', 'repo:deadbridge-crm'); L('ci:deadbridge', 'pr:57');
N('sentry:UMBRA-1F', 'dev', 'sentry', 'sentry: SAMPLE-1F'); L('sentry:UMBRA-1F', 'repo:umbra');
N('sentry:DB-0A', 'dev', 'sentry', 'sentry: SAMPLE-0A'); L('sentry:DB-0A', 'repo:deadbridge-crm');
N('posthog:deadbridge', 'dev', 'posthog', 'posthog: deadbridge.app'); L('posthog:deadbridge', 'repo:deadbridge-crm');
// lab
['proxmox', 'docker-01', 'adguard', 'n8n', 'supabase', 'bridge', 'mac-helper', 'tailscale'].forEach(d => { N('dev:' + d, 'lab', 'device', d); L('hub:lab', 'dev:' + d); });
L('dev:proxmox', 'dev:docker-01'); L('dev:docker-01', 'dev:n8n'); L('dev:docker-01', 'dev:adguard'); L('dev:bridge', 'dev:proxmox');
L('dev:supabase', 'repo:umbra'); L('dev:bridge', 'repo:umbra'); L('dev:bridge', 'dev:mac-helper'); L('dev:tailscale', 'dev:bridge'); L('repo:homelab-iac', 'dev:proxmox');
// print
N('dev:pro-1000', 'print', 'device', 'PRO-1000'); N('dev:cups', 'print', 'device', 'cups');
L('hub:print', 'dev:pro-1000'); L('hub:print', 'dev:cups'); L('dev:cups', 'dev:pro-1000'); L('dev:cups', 'dev:bridge');
['job:print-0931', 'job:print-0932'].forEach(j => { N(j, 'print', 'job', j); L(j, 'dev:cups'); });
// astro
['pi-indi', 'onstep', 'a7ii'].forEach(d => { N('dev:' + d, 'astro', 'device', d === 'a7ii' ? 'sony a7 II' : d); L('hub:astro', 'dev:' + d); });
L('dev:pi-indi', 'dev:onstep'); L('dev:pi-indi', 'dev:a7ii'); L('dev:pi-indi', 'dev:bridge');
['M31', 'M33', 'M42', 'M45', 'NGC7000'].forEach(t => { N('tgt:' + t, 'astro', 'target', t); L('tgt:' + t, 'hub:astro'); L('tgt:' + t, 'repo:parallax'); });
['session:09-14', 'session:09-28', 'session:10-02'].forEach(s => { N(s, 'astro', 'session', s); L(s, 'dev:a7ii'); });
L('session:10-02', 'tgt:M31'); L('session:09-28', 'tgt:M45');
// biz
N('crm:frappe', 'biz', 'service', 'frappe crm'); L('hub:biz', 'crm:frappe'); L('crm:frappe', 'repo:deadbridge-crm');
for (let i = 1; i <= 7; i++) { const id = 'lead:' + i; N(id, 'biz', 'lead', i === 7 ? 'lead: Sample Studio LLC' : 'lead ' + i); L(id, 'crm:frappe'); }
// cameras
['cam:porch', 'cam:garage', 'cam:desk', 'cam:nvr'].forEach(c => { N(c, 'cam', 'device', c); L(c, 'hub:cam'); });
L('cam:nvr', 'dev:proxmox'); ['cam:porch', 'cam:garage', 'cam:desk'].forEach(c => L(c, 'cam:nvr'));
// life / focus / comms
['focus:today', 'comms:inbox', 'cal:week', 'task:wireframes'].forEach(x => { N(x, 'life', 'life', x); L(x, 'hub:life'); });
L('task:wireframes', 'repo:umbra'); L('task:wireframes', 'figma:console-v0');
// knowledge: obsidian vault — many notes, links become edges
N('vault', 'know', 'vault', 'vault'); L('vault', 'hub:know');
const notes = [];
for (let i = 0; i < 64; i++) { const id = 'note:' + i; N(id, 'know', 'note', 'note ' + i); notes.push(id); }
notes.forEach((id, i) => {
  if (i < 10) L(id, 'vault'); else L(id, notes[Math.floor(R() * i)]);
  if (R() < 0.35) L(id, notes[Math.floor(R() * notes.length)]);
});
// notes reference real things
['repo:umbra', 'repo:parallax', 'session:09-14', 'session:09-28', 'session:10-02', 'dev:proxmox', 'lead:3', 'crm:frappe', 'tgt:M42', 'task:wireframes', 'dev:pro-1000']
  .forEach(t => L(notes[Math.floor(R() * notes.length)], t));

// ---------- system core layout (polar, deterministic; derived from the same graph model) ----------
// 7 domain sectors around a central core. Each sector: hub on the hub ring, tier-1 entities on a bus
// arc, tier-2 children on an outer bus arc. Dense sets (notes, leads, extra devices) are capped, not drawn.
const CX = 960, CY = 540, K = 1.06;
const RR = { core: 22, inner: 60, hub: 120, bus1: 150, t1: 182, bus2: 205, t2: 230, dial: 254, label: 278 };
Object.keys(RR).forEach(k => RR[k] = +(RR[k] * K).toFixed(1));
const SECT = [['astro', 'ASTRO'], ['biz', 'BUSINESS'], ['cam', 'CAMERAS'], ['know', 'KNOWLEDGE'], ['print', 'PRINT'], ['lab', 'LAB/NET'], ['dev', 'DEV']];
const SW = 2 * Math.PI / SECT.length;
const secAng = {}; SECT.forEach(([d], i) => secAng[d] = -Math.PI / 2 + SW / 2 + i * SW);
globalThis.CX0 = CX; globalThis.CY0 = CY;
const pol = (r, a) => [CX + r * Math.cos(a), CY + r * Math.sin(a)];
const deg = {}; const adj = {};
links.forEach(l => { deg[l.s] = (deg[l.s] || 0) + 1; deg[l.t] = (deg[l.t] || 0) + 1; (adj[l.s] ??= []).push(l.t); (adj[l.t] ??= []).push(l.s); });
const KPRI = { device: 0, repo: 0, service: 0, vault: 0, pr: 0, job: 0, design: 1, ci: 1, sentry: 1, session: 1, target: 2, posthog: 2, lead: 2, note: 3 };
const MUST = new Set(['lead:7', 'tgt:M31', 'dev:onstep', 'dev:bridge', 'dev:supabase', 'ci:deadbridge', 'sentry:UMBRA-1F', 'sentry:DB-0A']);
const CAP1 = { def: 6 }, CAP2 = { def: 6, dev: 8, know: 5, biz: 5 };
const rank = (a, b) => (MUST.has(b.id) - MUST.has(a.id)) || (KPRI[a.kind] ?? 4) - (KPRI[b.kind] ?? 4) || deg[b.id] - deg[a.id] || a.id.localeCompare(b.id);
const order = (a, b) => (KPRI[a.kind] ?? 4) - (KPRI[b.kind] ?? 4) || a.id.localeCompare(b.id);
const CORE = {}; const coreNode = {}; // id -> {x,y,a,r,tier,dom,parent}
for (const [d] of SECT) {
  const a0 = secAng[d]; const hub = 'hub:' + d;
  coreNode[hub] = { id: hub, dom: d, tier: 0, a: a0, r: RR.hub };
  const t1 = (adj[hub] || []).map(id => byId[id]).filter(n => n.dom === d && n.kind !== 'hub').sort(rank).slice(0, CAP1[d] ?? CAP1.def).sort(order);
  const span1 = SW * 0.74;
  t1.forEach((n, i) => { coreNode[n.id] = { id: n.id, dom: d, tier: 1, parent: hub, a: a0 - span1 / 2 + span1 * (i + 0.5) / t1.length, r: RR.t1 }; });
  const seen = new Set(); const cand = [];
  t1.forEach(p => (adj[p.id] || []).forEach(id => { const n = byId[id]; if (n.dom === d && n.kind !== 'hub' && !coreNode[id] && !seen.has(id)) { seen.add(id); cand.push({ n, parent: p.id }); } }));
  const t2 = cand.sort((x, y) => rank(x.n, y.n)).slice(0, CAP2[d] ?? CAP2.def)
    .sort((x, y) => coreNode[x.parent].a - coreNode[y.parent].a || order(x.n, y.n));
  const span2 = SW * 0.8;
  t2.forEach(({ n, parent }, i) => { coreNode[n.id] = { id: n.id, dom: d, tier: 2, parent, a: a0 - span2 / 2 + span2 * (i + 0.5) / t2.length, r: RR.t2 }; });
  CORE[d] = { a0, hub, t1: t1.map(n => n.id), t2: t2.map(x => x.n.id) };
}
Object.values(coreNode).forEach(c => { [c.x, c.y] = pol(c.r, c.a); });
const CP = id => [coreNode[id].x, coreNode[id].y];
// cross-domain links aggregated hub<->hub (inner chords); weight = link count in the full graph
const chordW = {};
links.forEach(l => { const a = byId[l.s].dom, b = byId[l.t].dom; if (a !== b && secAng[a] != null && secAng[b] != null) { const k = [a, b].sort().join('|'); chordW[k] = (chordW[k] || 0) + 1; } });
const shownCount = Object.keys(coreNode).length;

// ---------- svg helpers ----------
const T = (x, y, s, o = {}) => `<text x="${x}" y="${y}" font-size="${o.size ?? 11}" fill="${o.fill ?? C.mid}" ${o.anchor ? `text-anchor="${o.anchor}"` : ''} ${o.ls != null ? `letter-spacing="${o.ls}"` : ''} ${o.weight ? `font-weight="${o.weight}"` : ''} ${o.op != null ? `opacity="${o.op}"` : ''} ${o.filter ? `filter="url(#${o.filter})"` : ''}>${esc(s)}</text>`;
const Ln = (x1, y1, x2, y2, st = C.line, o = {}) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${st}" stroke-width="${o.w ?? 1}" ${o.dash ? `stroke-dasharray="${o.dash}"` : ''} ${o.op != null ? `opacity="${o.op}"` : ''} ${o.filter ? `filter="url(#${o.filter})"` : ''}/>`;
const Rect = (x, y, w, h, o = {}) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${o.fill ?? 'none'}" stroke="${o.stroke ?? C.line}" stroke-width="${o.w ?? 1}" ${o.dash ? `stroke-dasharray="${o.dash}"` : ''} ${o.op != null ? `opacity="${o.op}"` : ''} ${o.filter ? `filter="url(#${o.filter})"` : ''}/>`;
// annotation callout: dashed gray leader from target -> label, label in note gray with [n]
function callout(n, tx, ty, lx, ly, lines, anchor = 'start') {
  const arr = Array.isArray(lines) ? lines : [lines];
  const ex = anchor === 'start' ? lx - 6 : lx + 6;
  let s = `<g class="note">`;
  s += `<circle cx="${tx}" cy="${ty}" r="2.5" fill="none" stroke="${C.note}" stroke-width="1"/>`;
  s += `<polyline points="${tx},${ty} ${ex},${ly - 4}" fill="none" stroke="${C.note}" stroke-width="0.8" stroke-dasharray="2 3" opacity="0.7"/>`;
  arr.forEach((t, i) => { s += T(lx, ly + i * 15, (i === 0 ? `[${n}] ` : '    ') + t, { size: 11, fill: C.note, anchor }); });
  return s + '</g>';
}

// ---------- shared chrome ----------
const LEFT = [['dev', 'DEV', 330], ['lab', 'LAB/NET', 450], ['print', 'PRINT', 570]];
const RIGHT = [['astro', 'ASTRO', 330], ['biz', 'BUSINESS', 450], ['cam', 'CAMERAS', 570], ['know', 'KNOWLEDGE', 690]];
function grid() {
  return `<defs>
  <pattern id="gmin" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="${C.gridMinor}" stroke-width="1"/></pattern>
  <pattern id="gmaj" width="200" height="200" patternUnits="userSpaceOnUse"><path d="M200 0H0V200" fill="none" stroke="${C.gridMajor}" stroke-width="1"/></pattern>
  <radialGradient id="vign" cx="50%" cy="50%" r="70%"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.65"/></radialGradient>
  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <radialGradient id="halo-grey" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#cfd6de" stop-opacity="0.55"/><stop offset="22%" stop-color="#cfd6de" stop-opacity="0.16"/><stop offset="60%" stop-color="#cfd6de" stop-opacity="0.03"/><stop offset="100%" stop-color="#cfd6de" stop-opacity="0"/></radialGradient>
  <radialGradient id="halo-cyan" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="${C.cyan}" stop-opacity="0.7"/><stop offset="18%" stop-color="${C.cyan}" stop-opacity="0.26"/><stop offset="55%" stop-color="${C.cyan}" stop-opacity="0.06"/><stop offset="100%" stop-color="${C.cyan}" stop-opacity="0"/></radialGradient>
  <filter id="bloom" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="glow2" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="1920" height="1080" fill="${C.bg}"/><rect width="1920" height="1080" fill="url(#gmin)"/><rect width="1920" height="1080" fill="url(#gmaj)"/><rect width="1920" height="1080" fill="url(#vign)"/>`;
}
// rails as tiny ticks. state: {dom: {color, op}}
function rails(state = {}, ghostOthers = 1) {
  let s = Ln(10, 290, 10, 610, C.line) + Ln(1910, 290, 1910, 730, C.line);
  LEFT.forEach(([d, label, y]) => {
    const st = state[d]; const col = st?.color ?? C.dim; const op = st ? 1 : ghostOthers; const f = st?.color ? 'glow' : null;
    s += `<g opacity="${op}">` + Ln(4, y, 18, y, col, { w: st?.color ? 1.5 : 1, filter: f }) + T(26, y + 4, label, { size: 10, ls: 2, fill: st?.color ? st.color : C.dim }) + '</g>';
  });
  RIGHT.forEach(([d, label, y]) => {
    const st = state[d]; const col = st?.color ?? C.dim; const op = st ? 1 : ghostOthers; const f = st?.color ? 'glow' : null;
    s += `<g opacity="${op}">` + Ln(1902, y, 1916, y, col, { w: st?.color ? 1.5 : 1, filter: f }) + T(1894, y + 4, label, { size: 10, ls: 2, fill: st?.color ? st.color : C.dim, anchor: 'end' }) + '</g>';
  });
  return s;
}
function topChrome({ voice = 'idle', mode = null, healthOp = 1 } = {}) {
  let s = '';
  // wordmark + bridge health heartbeats
  s += T(40, 52, 'UMBRA', { size: 12, ls: 5, fill: C.mid });
  s += `<g opacity="${healthOp}">`;
  [['bridge', 40], ['pi', 112], ['mac', 158], ['printer', 210]].forEach(([k, x]) => { s += `<circle cx="${x + 2}" cy="73" r="2" fill="${C.dim}"/>` + T(x + 9, 77, k, { size: 9.5, fill: C.dim, ls: 1 }); });
  s += '</g>';
  // clock
  s += T(960, 78, '20:54', { size: 44, fill: C.ink, anchor: 'middle', weight: 200, ls: 4 });
  s += T(960, 102, 'MON 05 OCT 2026 · MT', { size: 10, fill: C.dim, anchor: 'middle', ls: 3 });
  if (mode) s += T(960, 128, mode, { size: 10, fill: C.cyan, anchor: 'middle', ls: 4 });
  // voice indicator
  const states = ['idle', 'listening', 'thinking', 'speaking'];
  const active = voice !== 'idle';
  s += `<g>`;
  if (!active) {
    s += `<circle cx="1740" cy="50" r="6" fill="none" stroke="${C.dim}" stroke-width="1"/>`;
    s += T(1754, 54, 'VOICE · IDLE', { size: 10, ls: 2, fill: C.dim });
  } else {
    s += `<circle cx="1740" cy="50" r="5" fill="${C.cyan}" filter="url(#glow)"/><circle class="ring" cx="1740" cy="50" r="10" fill="none" stroke="${C.cyan}" stroke-width="1" opacity="0.5"/>`;
    s += T(1754, 54, 'VOICE · ' + voice.toUpperCase(), { size: 10, ls: 2, fill: C.cyan });
  }
  let x = 1880;
  // state row (right aligned)
  const row = states.map(st => st).reverse();
  row.forEach(st => { const w = st.length * 6.2; x -= w; s += T(x, 76, st, { size: 9.5, fill: st === voice ? (active ? C.cyan : C.mid) : C.ghost }); x -= 12; });
  if (voice === 'speaking') { // waveform
    const hs = [4, 9, 14, 7, 18, 11, 6, 13, 8, 4, 10, 5];
    hs.forEach((h, i) => { s += Ln(1666 + i * 5, 50 - h / 2, 1666 + i * 5, 50 + h / 2, C.cyan, { w: 1.5, op: 0.85 }).replace('<line ', '<line class="wv" '); });
  }
  s += '</g>';
  return s;
}
function bottomChrome({ op = 1, focusHidden = false } = {}) {
  let s = `<g opacity="${op}">`;
  // cmd-k hint (left)
  s += Rect(40, 1027, 30, 18, { stroke: C.ghost }) + T(55, 1040, '⌘K', { size: 10, fill: C.dim, anchor: 'middle' }) + T(80, 1040, 'command', { size: 10, fill: C.ghost, ls: 1 });
  // focus strip (center)
  if (!focusHidden) {
    s += T(780, 1040, 'FOCUS', { size: 10, ls: 2, fill: C.dim }) + T(840, 1040, 'wireframe review', { size: 10, fill: C.mid }) + T(1140, 1040, '00:42', { size: 10, fill: C.dim, anchor: 'end' });
    s += Ln(780, 1050, 1140, 1050, C.line) + Ln(780, 1050, 880, 1050, C.dim);
  }
  // comms strip (right)
  s += T(1640, 1040, 'COMMS', { size: 10, ls: 2, fill: C.dim }) + T(1700, 1040, '2 unread · 0 urgent', { size: 10, fill: C.dim });
  return s + '</g>';
}
function frameTag(id, name) { return T(40, 1070, `${id} · ${name} · lo-fi wireframe · 1920×1080 · [n] gray dashed notes are annotations, not UI`, { size: 9.5, fill: '#3c4148', ls: 0.5 }); }

// ---------- brain renderer: engineered system core ----------
// lit: {nodeId: color}. glow: {c: 'grey'|'cyan', r, op}. voice: draw pulse ring + ripples.
const G = '#9aa3ad';
const f1 = v => (+v).toFixed(1);
const arcPath = (r, a1, a2) => { if (a2 < a1) [a1, a2] = [a2, a1]; const [x1, y1] = pol(r, a1), [x2, y2] = pol(r, a2); return `M${f1(x1)} ${f1(y1)}A${r} ${r} 0 ${a2 - a1 > Math.PI ? 1 : 0} 1 ${f1(x2)} ${f1(y2)}`; };
const P_ = (d, st, o = {}) => `<path d="${d}" fill="none" stroke="${st}" stroke-width="${o.w ?? 1}" ${o.op != null ? `opacity="${o.op}"` : ''} ${o.dash ? `stroke-dasharray="${o.dash}"` : ''} ${o.filter ? `filter="url(#${o.filter})"` : ''}/>`;
const radial = (a, r1, r2, st, o) => { const [x1, y1] = pol(r1, a), [x2, y2] = pol(r2, a); return Ln(f1(x1), f1(y1), f1(x2), f1(y2), st, o); };
function coreGlyph({ col = null, op = 1, cx: CX = globalThis.CX0, cy: CY = globalThis.CY0 } = {}) {
  const c = col ?? G; let s = `<g opacity="${op}">`;
  s += `<circle cx="${CX}" cy="${CY}" r="3.2" fill="${c}" ${col ? 'filter="url(#bloom)"' : 'opacity="0.6"'}/>`;
  s += `<circle cx="${CX}" cy="${CY}" r="10" fill="none" stroke="${c}" stroke-width="1" opacity="${col ? 0.6 : 0.3}"/>`;
  s += `<circle cx="${CX}" cy="${CY}" r="${RR.core}" fill="none" stroke="${c}" stroke-width="1" opacity="${col ? 0.4 : 0.18}"/>`;
  [0, 1, 2, 3].forEach(i => { const a = i * Math.PI / 2 + Math.PI / 4, c1 = Math.cos(a), s1 = Math.sin(a); s += Ln(f1(CX + c1 * (RR.core - 4)), f1(CY + s1 * (RR.core - 4)), f1(CX + c1 * (RR.core + 4)), f1(CY + s1 * (RR.core + 4)), c, { op: col ? 0.5 : 0.22 }); });
  return s + '</g>';
}
function brain({ lit = {}, glow = { c: 'grey', r: 80, op: 0.3 }, voice = false, nodeOp = 0.34, pathOp = 0.09, ringOp = 0.11, labelLit = true, labelIds = null, labelMode = 'greedy', coreCol = null } = {}) {
  let bg = '', base = '', hi = '', nd = '', lb = '';
  const litSec = {}; SECT.forEach(([d]) => { if (lit['hub:' + d]) litSec[d] = lit['hub:' + d]; });
  // halo (bloom) — the only soft element; breathes when idle, RMS-driven when speaking
  bg += `<g id="halo-g"><circle class="halo${glow.breathe ? ' halo-breathe' : ''}" cx="${CX}" cy="${CY}" r="${glow.r}" fill="url(#halo-${glow.c})" opacity="${glow.op}"/></g>`;
  // lit sector wedge (very faint fill between inner ring and dial)
  Object.entries(litSec).forEach(([d, col]) => {
    const a1 = secAng[d] - SW / 2, a2 = secAng[d] + SW / 2; const [ox1, oy1] = pol(RR.dial, a1), [ox2, oy2] = pol(RR.dial, a2), [ix2, iy2] = pol(RR.inner, a2), [ix1, iy1] = pol(RR.inner, a1);
    bg += `<path d="M${f1(ox1)} ${f1(oy1)}A${RR.dial} ${RR.dial} 0 0 1 ${f1(ox2)} ${f1(oy2)}L${f1(ix2)} ${f1(iy2)}A${RR.inner} ${RR.inner} 0 0 0 ${f1(ix1)} ${f1(iy1)}Z" fill="${col}" opacity="0.035"/>`;
    bg += P_(arcPath(RR.dial, a1 + 0.004, a2 - 0.004), col, { op: 0.55, w: 1.5, filter: 'glow' });
  });
  // rings: segmented inner ring, hub ring, outer dial with ticks
  SECT.forEach(([d]) => { const a = secAng[d]; base += P_(arcPath(RR.inner, a - SW / 2 + 0.05, a + SW / 2 - 0.05), litSec[d] ?? G, { op: litSec[d] ? 0.5 : ringOp }); });
  base += `<circle cx="${CX}" cy="${CY}" r="${RR.hub}" fill="none" stroke="${G}" stroke-width="1" opacity="${ringOp * 0.7}"/>`;
  base += `<circle cx="${CX}" cy="${CY}" r="${RR.dial}" fill="none" stroke="${G}" stroke-width="1" opacity="${ringOp}"/>`;
  for (let i = 0; i < 120; i++) { const a = -Math.PI / 2 + i * Math.PI / 60; const major = i % 5 === 0; base += radial(a, RR.dial + 2, RR.dial + (major ? 7 : 4), G, { op: ringOp * (major ? 0.9 : 0.55) }); }
  // sector dividers
  SECT.forEach(([d]) => { const a = secAng[d] - SW / 2; base += radial(a, RR.inner + 6, RR.dial + 12, G, { op: ringOp * 0.55 }); });
  // inner chords: cross-domain links aggregated hub<->hub (straight lattice, masked clear of the core)
  base += `<mask id="coremask"><rect width="1920" height="1080" fill="#fff"/><circle cx="${CX}" cy="${CY}" r="${RR.core + 16}" fill="#000"/></mask>`;
  base += '<g mask="url(#coremask)">';
  Object.entries(chordW).forEach(([k, w]) => {
    const [a, b] = k.split('|'); const [x1, y1] = CP('hub:' + a), [x2, y2] = CP('hub:' + b);
    const on = litSec[a] && litSec[b];
    const d = `M${f1(x1)} ${f1(y1)}L${f1(x2)} ${f1(y2)}`;
    if (on) hi += P_(d, litSec[a] === litSec[b] ? litSec[a] : C.cyan, { op: 0.45 }); else base += P_(d, G, { op: Math.min(0.1, 0.035 + w * 0.006) });
  });
  base += '</g>';
  // per-sector pathways
  for (const [d] of SECT) {
    const S = CORE[d]; const a0 = S.a0; const hc = litSec[d];
    // spoke core -> hub
    base += radial(a0, RR.core + 6, RR.hub - 6, G, { op: pathOp * 1.3 });
    if (hc) hi += radial(a0, RR.core + 6, RR.hub - 6, hc, { op: 0.7, filter: 'glow' });
    if (S.t1.length) {
      const as = S.t1.map(id => coreNode[id].a); const lo = Math.min(a0, ...as), hiA = Math.max(a0, ...as);
      base += radial(a0, RR.hub + 6, RR.bus1, G, { op: pathOp }) + P_(arcPath(RR.bus1, lo, hiA), G, { op: pathOp });
      S.t1.forEach(id => { base += radial(coreNode[id].a, RR.bus1, RR.t1 - 4, G, { op: pathOp }); });
      if (hc) {
        const la = S.t1.filter(id => lit[id]).map(id => coreNode[id].a);
        if (la.length) {
          hi += radial(a0, RR.hub + 6, RR.bus1, hc, { op: 0.6 });
          const l1 = Math.min(a0, ...la), l2 = Math.max(a0, ...la);
          if (l2 - l1 > 0.001) hi += P_(arcPath(RR.bus1, l1, l2), hc, { op: 0.6 });
          S.t1.filter(id => lit[id]).forEach(id => { hi += radial(coreNode[id].a, RR.bus1, RR.t1 - 4, lit[id], { op: 0.7 }); });
        }
      }
    }
    // tier-2: one bus arc per parent
    const byParent = {}; S.t2.forEach(id => (byParent[coreNode[id].parent] ??= []).push(id));
    Object.entries(byParent).forEach(([pid, kids]) => {
      const pa = coreNode[pid].a; const as = kids.map(id => coreNode[id].a); const lo = Math.min(pa, ...as), hiA = Math.max(pa, ...as);
      base += radial(pa, RR.t1 + 4, RR.bus2, G, { op: pathOp });
      if (hiA - lo > 0.001) base += P_(arcPath(RR.bus2, lo, hiA), G, { op: pathOp });
      kids.forEach(id => { base += radial(coreNode[id].a, RR.bus2, RR.t2 - 3, G, { op: pathOp }); });
      const lk = kids.filter(id => lit[id]);
      if (lk.length && (lit[pid] || hc)) {
        const pc = lit[pid] ?? hc; const la = lk.map(id => coreNode[id].a); const l1 = Math.min(pa, ...la), l2 = Math.max(pa, ...la);
        hi += radial(pa, RR.t1 + 4, RR.bus2, pc, { op: 0.6 });
        if (l2 - l1 > 0.001) hi += P_(arcPath(RR.bus2, l1, l2), pc, { op: 0.6 });
        lk.forEach(id => { hi += radial(coreNode[id].a, RR.bus2, RR.t2 - 3, lit[id], { op: 0.75 }); });
      }
    });
  }
  // lit cross-sector links between lit leaves (e.g. umbra -> bridge / supabase)
  links.forEach(l => {
    const A = coreNode[l.s], B = coreNode[l.t]; if (!A || !B || A.dom === B.dom || A.tier === 0 || B.tier === 0) return;
    if (!(lit[l.s] && lit[l.t])) return;
    const d = `M${f1(A.x)} ${f1(A.y)}Q${f1(CX + ((A.x + B.x) / 2 - CX) * 0.3)} ${f1(CY + ((A.y + B.y) / 2 - CY) * 0.3)} ${f1(B.x)} ${f1(B.y)}`;
    hi += P_(d, C.cyan, { op: 0.4, dash: '3 3' });
  });
  // nodes
  Object.values(coreNode).forEach(c => {
    const col = lit[c.id];
    if (c.tier === 0) {
      nd += `<g transform="rotate(45 ${f1(c.x)} ${f1(c.y)})">` + `<rect x="${f1(c.x - 4.5)}" y="${f1(c.y - 4.5)}" width="9" height="9" fill="${C.bg}" stroke="${col ?? G}" stroke-width="1" ${col ? 'filter="url(#glow)"' : `opacity="${Math.min(1, nodeOp * 1.8)}"`}/>` + `</g>`;
      nd += `<circle cx="${f1(c.x)}" cy="${f1(c.y)}" r="1.6" fill="${col ?? G}" opacity="${col ? 1 : nodeOp * 1.6}"/>`;
    } else {
      const r = c.tier === 1 ? 2.8 : 1.9;
      if (col) nd += `<circle cx="${f1(c.x)}" cy="${f1(c.y)}" r="${r + 0.5}" fill="${col}" filter="url(#glow)"/>`;
      else nd += `<circle cx="${f1(c.x)}" cy="${f1(c.y)}" r="${r}" fill="${C.bg}" stroke="${G}" stroke-width="1" opacity="${c.tier === 1 ? nodeOp * 1.3 : nodeOp}"/>`;
    }
  });
  // rim labels (domain names); lit sector label takes the activity color
  const rimBoxes = [];
  SECT.forEach(([d, name]) => {
    const a = secAng[d]; const [x, y] = pol(RR.label, a); const ca = Math.cos(a);
    const anchor = Math.abs(ca) < 0.2 ? 'middle' : ca > 0 ? 'start' : 'end'; const tw = name.length * 7.4;
    const yy = y + 3.5 + (Math.sin(a) > 0.9 ? 6 : 0);
    if (labelMode === 'column' && litSec[d]) return;
    lb += T(f1(x), f1(yy), name, { size: 9.5, ls: 2, anchor, fill: litSec[d] ?? C.dim, op: litSec[d] ? 1 : 0.55 });
    const x0 = anchor === 'start' ? x : anchor === 'end' ? x - tw : x - tw / 2; rimBoxes.push([x0 - 4, yy - 12, x0 + tw + 4, yy + 4]);
  });
  // leaf labels for lit nodes
  if (labelLit) {
    const want = Object.keys(lit).filter(id => coreNode[id] && coreNode[id].tier > 0 && (!labelIds || labelIds.includes(id))).map(id => ({ n: byId[id], x: coreNode[id].x, y: coreNode[id].y, r: 3, c: lit[id], min: coreNode[id].tier === 2 ? Math.ceil((RR.dial + 10 - RR.t2) / Math.max(0.3, Math.abs(Math.cos(coreNode[id].a)))) : 0 }));
    const pts = Object.keys(lit).filter(id => coreNode[id]).map(id => ({ x: coreNode[id].x, y: coreNode[id].y }));
    lb += labelMode === 'column' ? columnLabels(want) : placeLabels(want, pts, { cx: CX, cy: CY, boxes: rimBoxes.concat([[CX - 30, CY - 30, CX + 30, CY + 30]]) });
  }
  // voice pulse: RMS-scaled ring + ripple echoes (static frame shows a loud moment)
  let pulse = '';
  if (voice) {
    pulse += `<g id="pulse-g"><circle id="pulse-ring" cx="${CX}" cy="${CY}" r="${f1(RR.core * 2)}" fill="none" stroke="${C.cyan}" stroke-width="1.2" opacity="0.7" filter="url(#bloom)"/></g>`;
    pulse += `<g id="ripples">` + [[RR.inner + 22, 0.32], [RR.hub + 44, 0.16], [RR.dial + 22, 0.07]].map(([r, o]) => `<circle class="ripple" cx="${CX}" cy="${CY}" r="${f1(r)}" fill="none" stroke="${C.cyan}" stroke-width="1" opacity="${o}"/>`).join('') + `</g>`;
  }
  return `<g class="brain">${bg}${pulse}${base}${hi}${nd}${coreGlyph({ col: coreCol })}${lb}</g>`;
}

// column labels: radial leader out past the dial, then into a stacked label column beside the core
function columnLabels(want) {
  let out = '';
  for (const side of [-1, 1]) {
    const items = want.map(w => ({ ...w, a: coreNode[w.n.id].a })).filter(w => (Math.cos(w.a) < 0.02 ? -1 : 1) === side)
      .map(w => { const [ox, oy] = pol(RR.dial + 12, w.a); return { ...w, ox, oy }; }).sort((p, q) => p.oy - q.oy);
    let last = -1e9; items.forEach(w => { w.ly = Math.max(w.oy, last + 15); last = w.ly; });
    const colX = side < 0 ? CX - RR.dial - 40 : CX + RR.dial + 40;
    items.forEach(w => {
      const ex = colX - side * 4, kx = w.ox + side * 6;
      out += `<polyline points="${f1(w.x)},${f1(w.y)} ${f1(w.ox)},${f1(w.oy)} ${f1(kx)},${f1(w.ly)} ${f1(ex)},${f1(w.ly)}" fill="none" stroke="${w.c}" stroke-width="0.8" opacity="0.35"/>`;
      out += T(f1(colX - side * 8 * 0), f1(w.ly + 3.5), w.n.label, { size: 10, fill: w.c, op: 0.9, anchor: side < 0 ? 'end' : 'start' });
    });
  }
  return out;
}

// greedy label placement: avoid overlapping other labels, lit nodes and fixed boxes; fall back to a short leader
function placeLabels(want, litPts, opt = {}) {
  const pri = { hub: 0, repo: 1, device: 2, target: 2, service: 2, lead: 3 };
  want.sort((a, b) => (pri[a.n.kind] ?? 4) - (pri[b.n.kind] ?? 4));
  const cx = opt.cx ?? litPts.reduce((a, p) => a + p.x, 0) / (litPts.length || 1), cy = opt.cy ?? litPts.reduce((a, p) => a + p.y, 0) / (litPts.length || 1);
  const boxes = litPts.map(p => [p.x - 5, p.y - 5, p.x + 5, p.y + 5]).concat(opt.boxes ?? []);
  const hit = b => boxes.some(o => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);
  let out = '';
  for (const w of want) {
    const tw = w.n.label.length * 6.05, th = 12; const away = w.x >= cx ? 1 : -1;
    const cands = [];
    for (const dist of [0, 18, 34, 52].map(v => v + (w.min ?? 0))) for (const dy of [0, -14, 14, -26, 26]) {
      cands.push({ side: away, dist, dy }); cands.push({ side: -away, dist, dy });
    }
    let pick = null;
    for (const c of cands) {
      const lx = c.side > 0 ? w.x + w.r + 6 + c.dist : w.x - w.r - 6 - c.dist - tw; const ly = w.y + c.dy;
      const b = [lx - 2, ly - th / 2 - 1, lx + tw + 2, ly + th / 2 + 1];
      if (!hit(b)) { pick = { lx, ly, b, c }; break; }
    }
    if (!pick) continue;
    boxes.push(pick.b);
    const { lx, ly, c } = pick;
    if (c.dist > 0 || c.dy !== 0) { const ex = c.side > 0 ? lx - 3 : lx + tw + 3; out += Ln(w.x.toFixed(1), w.y.toFixed(1), ex.toFixed(1), ly.toFixed(1), w.c, { op: 0.35, w: 0.8 }); }
    out += T(lx.toFixed(1), (ly + 3.5).toFixed(1), w.n.label, { size: 10, fill: w.c, op: 0.9 });
  }
  return out;
}

function page(title, svg, extraCss = '', script = '') {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Umbra wireframe · ${esc(title)}</title>
<script>if(location.hash==='#static')document.documentElement.classList.add('static')</script>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@200;300;400;500&display=swap" rel="stylesheet">
<style>
html,body{margin:0;padding:0;background:${C.bg};overflow:hidden}
svg{display:block;width:1920px;height:1080px;font-family:'JetBrains Mono',ui-monospace,Menlo,monospace;font-weight:300}
text{font-family:'JetBrains Mono',ui-monospace,Menlo,monospace}
.note text{font-weight:300}
@keyframes breathe{0%,100%{opacity:.55}50%{opacity:1}}
.halo-breathe{animation:breathe 9s ease-in-out infinite}
@keyframes ring{0%{r:7;opacity:.6}100%{r:16;opacity:0}}
.ring{animation:ring 1.6s ease-out infinite}
${extraCss}
html.static *{animation:none!important}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
</style></head><body>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080">
${svg}
</svg>${script ? `\n<script>\n${script}\n</script>` : ''}</body></html>`;
}
const write = (f, html) => { fs.writeFileSync(path.join(OUT, f), html); console.log('wrote', f); };

// ============ FRAME 1: IDLE ============
const IDLE_BRAIN = { glow: { c: 'grey', r: 78, op: 0.32, breathe: true }, nodeOp: 0.3, pathOp: 0.075, ringOp: 0.1 };
{
  let s = grid() + brain(IDLE_BRAIN) + rails() + topChrome() + bottomChrome() + frameTag('WF-01', 'IDLE');
  const [kx, ky] = CP('hub:print');
  s += callout(1, 1010, 70, 1110, 62, ['clock — the only always-legible text', 'local MT; no seconds, no animation']);
  s += callout(2, kx, ky, 380, 880, ['system core, near-dormant: 7 domain sectors,', 'one hub each, sparse leaves on radial/arc paths', `(${shownCount} nodes from the graph; dense sets capped)`, 'faint grey halo breathes (9s); no color at idle']);
  s += callout(3, 22, 330, 120, 250, ['edge rails = tiny labeled ticks (L: dev / lab / print,', 'R: astro / biz / cameras / knowledge); touch wakes one']);
  s += callout(4, 1740, 50, 1560, 130, ['voice: dormant ring; local wake word', 'idle · listening · thinking · speaking']);
  s += callout(5, 960, 1036, 1000, 985, ['focus strip (bottom-center) · current task only']);
  s += callout(6, 1700, 1036, 1520, 985, ['comms strip: counts only, no inbox']);
  s += callout(7, 44, 73, 120, 140, ['bridge health: gray = ok, red node if dead']);
  write('idle.html', page('01 idle', s));
}

// ============ FRAME 2: DEV RAIL AWAKE ============
{
  const lit = {};
  CORE.dev.t1.concat(CORE.dev.t2).forEach(id => lit[id] = C.cyan);
  lit['hub:dev'] = C.cyan; lit['ci:deadbridge'] = C.red; lit['sentry:UMBRA-1F'] = C.amber; lit['sentry:DB-0A'] = C.amber;
  lit['dev:supabase'] = C.cyan; lit['dev:bridge'] = C.cyan;
  let s = grid() + brain({ lit, glow: { c: 'cyan', r: 96, op: 0.32 }, coreCol: C.cyan, labelMode: 'column', labelIds: ['repo:umbra', 'repo:deadbridge-crm', 'pr:142', 'pr:57', 'ci:deadbridge', 'sentry:UMBRA-1F', 'sentry:DB-0A', 'dev:bridge', 'dev:supabase'], nodeOp: 0.26, pathOp: 0.07, ringOp: 0.09 }) + rails({ dev: { color: C.cyan } }, 0.5) + topChrome() + bottomChrome({ op: 0.6 }) + frameTag('WF-02', 'DEV RAIL AWAKE');
  // rail panel docked to left edge column
  const X = 100, Y = 120, W = 400; let H = 860;
  s += Ln(26 + 3 * 8 + 6, 330, X, 330, C.cyan, { op: 0.6 });
  s += '%%PANEL%%';
  let y = Y + 30; const x = X + 20, xr = X + W - 20;
  s += T(x, y, 'DEV', { size: 12, ls: 4, fill: C.cyan }) + T(xr, y, 'SAMPLE DATA', { size: 9.5, fill: C.dim, anchor: 'end', ls: 2 });
  y += 16; s += T(x, y, 'touched 20:54 · esc / 20s idle to collapse', { size: 9.5, fill: C.dim });
  const sec = (label, right) => { y += 34; s += Ln(x, y - 14, xr, y - 14, C.line) + T(x, y, label, { size: 9.5, ls: 2, fill: C.mid }) + (right ? T(xr, y, right, { size: 9.5, fill: C.dim, anchor: 'end' }) : ''); y += 8; };
  const row = (cols, col = C.ink) => { y += 20; cols.forEach(([t, cx, o]) => s += T(cx, y, t, { size: 10.5, fill: o?.fill ?? col, anchor: o?.anchor })); };
  sec('PULL REQUESTS', '3 open · github');
  row([['#142', x], ['umbra', x + 48], ['feat/mesh-sim', x + 140], ['review', xr, { anchor: 'end', fill: C.cyan }]]);
  row([['#138', x], ['umbra', x + 48], ['chore/tw-tokens', x + 140], ['✓ ready', xr, { anchor: 'end', fill: C.mid }]]);
  row([['#57', x], ['deadbridge', x + 48], ['fix/lead-dedupe', x + 140], ['✕ checks', xr, { anchor: 'end', fill: C.red }]]);
  sec('TESTS · main', 'ci');
  row([['umbra', x], ['212 pass · 0 fail', x + 110], ['✓', xr, { anchor: 'end', fill: C.mid }]]);
  row([['deadbridge', x], ['88 pass · 2 fail', x + 110], ['✕', xr, { anchor: 'end', fill: C.red }]]);
  row([['  ✕ leads.dedupe.spec › merges by email', x]], C.red);
  row([['  ✕ leads.import.spec › empty csv', x]], C.red);
  sec('SENTRY · 24h', 'sentry');
  row([['SAMPLE-1F', x], ['TypeError: node.x undef', x + 92], ['×14', xr, { anchor: 'end', fill: C.amber }]], C.ink);
  row([['SAMPLE-0A', x], ['Timeout /api/leads', x + 92], ['×3', xr, { anchor: 'end', fill: C.amber }]], C.ink);
  sec('POSTHOG · 24h', 'deadbridge.app');
  y += 14;
  { // sparkline with blip
    const pts = [12, 13, 11, 12, 14, 13, 12, 13, 12, 14, 13, 12, 13, 14, 13, 12, 13, 15, 14, 13, 24, 31, 22, 16];
    const sx = x, sw = 250, sh = 40; const by = y + 30;
    const d = pts.map((v, i) => `${(sx + i * sw / (pts.length - 1)).toFixed(1)},${(by - v).toFixed(1)}`).join(' ');
    s += Ln(sx, by, sx + sw, by, C.line) + `<polyline points="${d}" fill="none" stroke="${C.mid}" stroke-width="1"/>`;
    const bi = 21; s += `<circle cx="${(sx + bi * sw / (pts.length - 1)).toFixed(1)}" cy="${by - 31}" r="2.5" fill="${C.amber}" filter="url(#glow)"/>`;
    s += T(xr, y + 6, 'pageviews', { size: 9.5, fill: C.dim, anchor: 'end' }) + T(xr, y + 22, '▲ +38% blip', { size: 10.5, fill: C.amber, anchor: 'end' }) + T(xr, y + 36, 'vs 7d avg', { size: 9.5, fill: C.dim, anchor: 'end' });
    y = by + 6;
  }
  sec('FIGMA', 'figma');
  row([['Umbra / Console v0', x], ['edited 40m ago', xr, { anchor: 'end', fill: C.dim }]]);
  // footer actions
  H = y + 90 - Y;
  s = s.replace('%%PANEL%%', Rect(X, Y, W, H, { fill: C.panel, stroke: C.line }) + Ln(X, Y, X, Y + H, C.cyan, { op: 0.7, filter: 'glow' }));
  s += Ln(x, Y + H - 50, xr, Y + H - 50, C.line);
  s += T(x, Y + H - 26, 'open PR #57   rerun ci   open in sentry', { size: 10, fill: C.dim });
  s += T(xr, Y + H - 26, 'say or ⌘K', { size: 9.5, fill: C.ghost, anchor: 'end' });
  // callouts
  s += callout(1, X + W, Y + 200, 560, 160, ['only the touched rail expands; docked to', 'its edge tick — not a floating panel']);
  { const [tx, ty] = pol(RR.dial, -Math.PI / 2 - 0.04); s += callout(2, tx, ty, 1010, 178, ['dev sector lit: spoke → hub → bus → leaves; core', 'glow cyan, low · red = failing ci, amber = sentry', 'dashed = cross-links (umbra → bridge / supabase)']); }
  s += callout(3, 30, 450, 30, 800, ['other rails stay as dim ticks'], 'start');
  s += callout(4, X + W / 2, Y + H, 560, Y + H + 60, ['row actions call the shared tool layer', '(same as voice + ⌘K)']);
  write('dev-rail-awake.html', page('02 dev rail awake', s));
}

// ============ FRAME 3: VOICE ACTIVE ============
// Lightweight pulse demo: a simulated speech envelope (syllable bursts + phrase gaps) drives ONE level
// value per frame -> halo scale/opacity + pulse-ring radius, ripples emitted on peaks. In the app this
// level is the LiveKit TTS track RMS fed to a single shader uniform. Skipped for #static and reduced motion.
const VOICE_DEMO = `(()=>{
  if (document.documentElement.classList.contains('static') || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const NS='http://www.w3.org/2000/svg', CX=${CX}, CY=${CY}, R0=${RR.core * 2};
  const halo=document.getElementById('halo-g'), ring=document.getElementById('pulse-ring'), rip=document.getElementById('ripples');
  const bars=[...document.querySelectorAll('.wv')];
  rip.querySelectorAll('.ripple').forEach(c=>c.remove());
  let lvl=0, prev=0, t0=performance.now(), lastRip=0;
  function env(t){ // fake speech: ~4.5 syllables/s, phrases of ~2.6s with ~0.6s gaps
    const ph=t%3.2; if(ph>2.6) return 0.04*Math.random();
    const syl=Math.max(0,Math.sin(t*Math.PI*4.5+Math.sin(t*1.7)*1.5));
    return Math.min(1,(0.35+0.65*Math.abs(Math.sin(t*0.9)))*syl*syl*(0.8+0.4*Math.random()));
  }
  function emit(){
    const c=document.createElementNS(NS,'circle');
    c.setAttribute('cx',CX);c.setAttribute('cy',CY);c.setAttribute('fill','none');c.setAttribute('stroke','${C.cyan}');c.setAttribute('stroke-width','1');
    rip.appendChild(c);
    c.animate([{r:R0,opacity:.45},{r:${RR.dial + 24},opacity:0}],{duration:1400,easing:'cubic-bezier(.2,.6,.3,1)'}).onfinish=()=>c.remove();
  }
  function frame(now){
    const t=(now-t0)/1000, target=env(t);
    lvl += (target-lvl)*(target>lvl?0.45:0.08); // fast attack, slow release
    const sc=0.82+0.45*lvl;
    halo.setAttribute('transform','translate('+CX+' '+CY+') scale('+sc.toFixed(3)+') translate('+(-CX)+' '+(-CY)+')');
    halo.style.opacity=(0.45+0.55*lvl).toFixed(3);
    ring.setAttribute('r',(R0*(1+0.7*lvl)).toFixed(1)); ring.setAttribute('opacity',(0.35+0.6*lvl).toFixed(2));
    bars.forEach((b,i)=>{const h=3+lvl*18*(0.5+0.5*Math.abs(Math.sin(t*9+i*1.3)));b.setAttribute('y1',(50-h/2).toFixed(1));b.setAttribute('y2',(50+h/2).toFixed(1));});
    if(lvl>0.62 && prev<=0.62 && now-lastRip>280){emit();lastRip=now;}
    prev=lvl; requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();`;
{
  const lit = { 'dev:pro-1000': C.amber, 'dev:cups': C.amber, 'hub:print': C.amber, 'lead:7': C.amber, 'crm:frappe': C.amber, 'hub:biz': C.amber, 'tgt:M31': C.cyan, 'dev:onstep': C.cyan, 'dev:pi-indi': C.cyan, 'hub:astro': C.cyan };
  let s = grid();
  s += brain({ lit, glow: { c: 'cyan', r: 190, op: 0.85 }, voice: true, coreCol: C.cyan, nodeOp: 0.34, pathOp: 0.085, ringOp: 0.12 });
  s += rails({ print: { color: C.amber }, biz: { color: C.amber }, astro: { color: C.cyan } }, 0.55) + topChrome({ voice: 'speaking' }) + bottomChrome({ op: 0.6, focusHidden: true }) + frameTag('WF-03', 'VOICE ACTIVE');
  // wake chips: brief, single-row, attached to rail ticks
  const chip = (side, y, col, l1, l2) => {
    const w = 330, x = side === 'L' ? 100 : 1808 - w;
    const lw = { 570: 5, 450: 8, 330: 5 }[y] * 8 + 6; let c = (side === 'L' ? Ln(26 + lw, y, x, y, col, { op: .5 }) : Ln(x + w, y, 1894 - lw, y, col, { op: .5 }));
    c += Rect(x, y - 22, w, 44, { fill: C.panel, stroke: C.line });
    c += Ln(side === 'L' ? x : x + w, y - 22, side === 'L' ? x : x + w, y + 22, col, { filter: 'glow' });
    c += T(x + 14, y - 3, l1, { size: 10.5, fill: col }) + T(x + 14, y + 13, l2, { size: 9.5, fill: C.dim });
    return c;
  };
  s += chip('L', 570, C.amber, 'PRO-1000 · CYAN INK 8%', '≈3 A3 prints left · sample');
  s += chip('R', 450, C.amber, 'NEW LEAD · Sample Studio LLC', 'deadbridge · web form · 6m ago · sample');
  s += chip('R', 330, C.cyan, 'M31 WINDOW · 21:40 → 03:10', 'clouds 12% · mount parked · sample');
  // transcript
  s += T(960, 868, 'YOU   what needs my attention?', { size: 11, fill: C.mid, anchor: 'middle' });
  s += T(960, 890, 'UMBRA   Three things: cyan ink is low, a new Deadbridge lead came in, and M31 clears at 21:40. Slew now?', { size: 12, fill: C.ink, anchor: 'middle' });
  // approval prompt docked into focus strip (bottom-center)
  const ax = 640, aw = 640, ay = 922, ah = 110;
  s += Rect(ax, ay, aw, ah, { fill: C.panel, stroke: C.amber, op: 1 });
  s += Ln(ax, ay, ax + aw, ay, C.amber, { filter: 'glow' });
  s += T(ax + 18, ay + 24, 'APPROVAL REQUIRED · PHYSICAL · astro.mount.slew', { size: 9.5, ls: 1.5, fill: C.amber });
  s += T(ax + aw - 18, ay + 24, 'FOCUS', { size: 9.5, ls: 2, fill: C.dim, anchor: 'end' });
  s += T(ax + 18, ay + 52, 'Slew mount to M31?', { size: 16, fill: C.ink, weight: 400 });
  s += T(ax + 230, ay + 52, 'RA 00h42m  Dec +41°16′  alt 34° ↑', { size: 10.5, fill: C.dim });
  s += Rect(ax + 18, ay + 68, 140, 28, { stroke: C.amber }) + T(ax + 88, ay + 86, 'CONFIRM  ⏎', { size: 10.5, fill: C.amber, anchor: 'middle', ls: 1 });
  s += Rect(ax + 170, ay + 68, 140, 28, { stroke: C.dim }) + T(ax + 240, ay + 86, 'CANCEL  esc', { size: 10.5, fill: C.mid, anchor: 'middle', ls: 1 });
  s += T(ax + aw - 18, ay + 86, 'or say “confirm” · limits: alt>15°', { size: 9.5, fill: C.dim, anchor: 'end' });
  // callouts
  s += callout(1, 1666, 50, 1420, 150, ['voice: SPEAKING (cyan) + live waveform;', 'state row shows where we are']);
  { const a = 0.62, [px, py] = pol(RR.hub + 44, a); s += callout(2, px, py, 1330, 735, ['glow + ring scale driven by voice audio level', '(RMS) per frame; single shader/uniform, no extra load', 'cited nodes light along their sector paths']); }
  s += callout(3, 330, 592, 150, 650, ['relevant rails wake briefly as one-line', 'chips (~8s), then fall back to ticks']);
  s += callout(4, ax, ay + 50, 250, 960, ['risky tool calls need explicit approval;', 'docks into focus strip, never auto-runs']);
  s += callout(5, 1335, 868, 1380, 840, ['one transcript line each; no chat log']);
  write('voice-active.html', page('03 voice active', s, '', VOICE_DEMO));
}

// ============ FRAME 4: ASTRO MODE (ORRERY) ============
{
  const cx = 800, cy = 560, tilt = 0.4, rot = -10;
  const rings = [70, 118, 172, 236, 312, 400];
  let s = grid();
  let o = `<g transform="rotate(${rot} ${cx} ${cy})">`;
  // halo at the core/sun (grey, low): same bloom language as the mesh core
  s += `<circle cx="${cx}" cy="${cy}" r="70" fill="url(#halo-grey)" opacity="0.3"/>`;
  rings.forEach((r, i) => {
    o += `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${(r * tilt).toFixed(1)}" fill="none" stroke="${G}" stroke-width="1" opacity="${(0.2 - i * 0.018).toFixed(3)}"/>`;
    o += `<path id="orb${i}" d="M ${cx - r} ${cy} a ${r} ${r * tilt} 0 1 0 ${2 * r} 0 a ${r} ${r * tilt} 0 1 0 ${-2 * r} 0" fill="none" stroke="none"/>`;
  });
  // outermost orbit keeps the core's dial ticks (the dial ring resolves into it)
  { const r = rings[rings.length - 1]; for (let i = 0; i < 120; i++) { const a = i * Math.PI / 60, major = i % 5 === 0; const r2 = r + (major ? 7 : 4);
    o += Ln(f1(cx + Math.cos(a) * (r + 2)), f1(cy + Math.sin(a) * (r + 2) * tilt), f1(cx + Math.cos(a) * r2), f1(cy + Math.sin(a) * r2 * tilt), G, { op: major ? 0.09 : 0.05 }); } }
  // domain hubs re-seated on orbits (morph result), ghosted; astro hub becomes the orrery itself
  ['dev', 'lab', 'print', 'biz', 'cam', 'know'].forEach((d, i) => { const r = rings[(i + 1) % rings.length], a = secAng[d] + (d === 'know' ? 1.3 : 0.35); const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * tilt;
    o += `<rect x="${f1(x - 3.5)}" y="${f1(y - 3.5)}" width="7" height="7" fill="${C.bg}" stroke="${G}" stroke-width="1" opacity="0.35" transform="rotate(45 ${f1(x)} ${f1(y)})"/>`; });
  // orbit direction ticks
  rings.forEach((r, i) => { const a = 0.6 + i * 0.5; const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * tilt; o += `<path d="M ${x - 4} ${y - 3} L ${x} ${y} L ${x - 4} ${y + 3}" fill="none" stroke="${C.mid}" stroke-width="1" opacity="0.5" transform="rotate(${(a * 180 / Math.PI + 90).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`; });
  // bodies
  const bodies = [['Mercury', 0, 2.0, 1.6], ['Venus', 1, 3.6, 2.4], ['Earth', 2, 0.9, 2.8], ['Mars', 3, 4.6, 2.2], ['Jupiter', 4, 2.6, 4.2], ['Saturn', 5, 5.4, 3.6]];
  const bpos = {};
  bodies.forEach(([name, ri, a, r]) => {
    const R0 = rings[ri]; const x = cx + Math.cos(a) * R0, y = cy + Math.sin(a) * R0 * tilt; bpos[name] = [x, y];
    const col = name === 'Earth' ? C.cyan : '#9aa3ad';
    o += `<g><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${col}" ${name === 'Earth' ? 'filter="url(#glow)"' : 'opacity="0.6"'}/></g>`;
  });
  // moon around earth
  const [ex, ey] = bpos.Earth;
  o += `<ellipse cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" rx="14" ry="${(14 * tilt).toFixed(1)}" fill="none" stroke="${C.cyan}" stroke-width="0.8" opacity="0.4"/><circle cx="${(ex + 14).toFixed(1)}" cy="${ey.toFixed(1)}" r="1.6" fill="${C.cyan}" opacity="0.8"/>`;
  o += `</g>`;
  s += `<g class="orrery">${o}</g>`;
  // sun = the core glyph (same dot / ring / tick ring as the mesh core)
  s += coreGlyph({ cx, cy, op: 1.4 });
  // labels (unrotated approximations)
  const rotp = ([x, y]) => { const a = rot * Math.PI / 180; const dx = x - cx, dy = y - cy; return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)]; };
  bodies.forEach(([name]) => { const [x, y] = rotp(bpos[name]); s += T((x + 9).toFixed(1), (y - 6).toFixed(1), name.toLowerCase() + (name === 'Earth' ? ' · you' : ''), { size: 10, fill: name === 'Earth' ? C.cyan : C.dim }); });
  s += T(cx + 28, cy - 14, 'sol', { size: 10, fill: C.dim });
  // target ray: earth -> M31 (deep sky marker outside orbits)
  const [exr, eyr] = rotp([ex, ey]); const mx = 470, my = 250;
  s += Ln(exr.toFixed(1), eyr.toFixed(1), mx, my, C.cyan, { dash: '3 4', op: 0.6 });
  s += `<g filter="url(#glow)"><circle cx="${mx}" cy="${my}" r="9" fill="none" stroke="${C.cyan}" stroke-width="1"/>` + Ln(mx - 16, my, mx - 11, my, C.cyan) + Ln(mx + 11, my, mx + 16, my, C.cyan) + Ln(mx, my - 16, mx, my - 11, C.cyan) + Ln(mx, my + 11, mx, my + 16, C.cyan) + '</g>';
  s += T(mx + 22, my - 4, 'M31 · TARGET', { size: 10.5, fill: C.cyan, ls: 1 }) + T(mx + 22, my + 11, 'alt 34° ↑ · transit 00:48', { size: 9.5, fill: C.dim });
  // queued targets ghost markers
  [['M33', 600, 200], ['NGC 7000', 360, 380]].forEach(([n, x, y]) => { s += `<circle cx="${x}" cy="${y}" r="5" fill="none" stroke="${C.mid}" stroke-width="0.8" opacity="0.5"/>` + T(x + 10, y + 3, n, { size: 9.5, fill: C.dim }); });
  s += rails({ astro: { color: C.cyan } }, 0.15) + topChrome({ mode: 'MODE · ASTRO', healthOp: 1 }) + bottomChrome({ op: 0.2 }) + frameTag('WF-04', 'ASTRO MODE');
  // astro rail panel (right)
  const W = 410, X = 1808 - W, Y = 120; let H = 860; let y = Y + 30; const x = X + 20, xr = X + W - 20;
  s += Ln(X + W, 330, 1894 - 5 * 8 - 6, 330, C.cyan, { op: 0.6 });
  s += '%%PANEL%%';
  s += T(x, y, 'ASTRO', { size: 12, ls: 4, fill: C.cyan }) + T(xr, y, 'SAMPLE DATA', { size: 9.5, fill: C.dim, anchor: 'end', ls: 2 });
  y += 16; s += T(x, y, 'mode entered 20:54 · esc to return to mesh', { size: 9.5, fill: C.dim });
  const sec = (label, right) => { y += 34; s += Ln(x, y - 14, xr, y - 14, C.line) + T(x, y, label, { size: 9.5, ls: 2, fill: C.mid }) + (right ? T(xr, y, right, { size: 9.5, fill: C.dim, anchor: 'end' }) : ''); y += 8; };
  const kv = (k, v, col = C.ink, vr) => { y += 20; s += T(x, y, k, { size: 10.5, fill: C.dim }) + T(x + 96, y, v, { size: 10.5, fill: col }) + (vr ? T(xr, y, vr[0], { size: 10.5, fill: vr[1], anchor: 'end' }) : ''); };
  sec('TONIGHT', 'mt');
  { // night timeline 18:00 -> 06:00
    y += 18; const tx = x, tw = xr - x, hr = tw / 12; const by = y;
    s += Rect(tx, by, tw, 14, { stroke: C.line });
    s += `<rect x="${(tx + 3.67 * hr).toFixed(1)}" y="${by}" width="${(7.25 * hr).toFixed(1)}" height="14" fill="${C.cyan}" opacity="0.14"/>` + Rect((tx + 3.67 * hr).toFixed(1), by, (7.25 * hr).toFixed(1), 14, { stroke: C.cyan, op: 0.6 });
    s += Ln(tx, by + 20, tx + 5.2 * hr, by + 20, C.mid, { w: 1, op: .6 });
    for (let i = 0; i <= 12; i += 3) s += T(tx + i * hr, by + 34, String((18 + i) % 24).padStart(2, '0'), { size: 9, fill: C.dim, anchor: i === 0 ? 'start' : i === 12 ? 'end' : 'middle' });
    s += Ln(tx + 2.9 * hr, by - 4, tx + 2.9 * hr, by + 18, C.ink, { op: .8 });
    y = by + 34;
  }
  kv('astro dark', '21:40 → 04:55', C.cyan);
  kv('moon', '23% · sets 23:12', C.ink);
  sec('CLOUDS', 'source TBD');
  { y += 8; const vals = [10, 8, 12, 15, 18, 30, 55, 70, 62, 40, 25, 20]; const bw = (xr - x) / vals.length;
    vals.forEach((v, i) => { const h = v * 0.4; s += `<rect x="${(x + i * bw + 2).toFixed(1)}" y="${(y + 30 - h).toFixed(1)}" width="${(bw - 4).toFixed(1)}" height="${h.toFixed(1)}" fill="${v >= 50 ? C.amber : '#9aa3ad'}" opacity="${v >= 50 ? 0.7 : 0.3}"/>`; });
    s += Ln(x, y + 30, xr, y + 30, C.line); y += 30; }
  kv('clear until', '~00:30, then 55–70%', C.amber);
  kv('seeing', '3/5 · transp 4/5 · wind 6', C.ink);
  sec('TARGET', 'via parallax');
  kv('now', 'M31 Andromeda', C.cyan); kv('position', 'alt 34° ↑ az 61° · tr 00:48'); kv('queue', 'M31 → M33 → NGC 7000', C.mid);
  sec('MOUNT', 'onstep · indi');
  kv('state', '○ parked · tracking off', C.mid); kv('next', 'slew M31 — needs approval', C.amber);
  sec('CAMERA', 'sony a7 II');
  kv('link', '● connected', C.cyan); kv('plan', 'ISO 800 · 120s · 0/40 subs'); kv('battery', '78%');
  sec('BRIDGE', 'pi-indi');
  kv('heartbeat', '2s ago · offline-capable', C.ink);
  H = y + 90 - Y;
  s = s.replace('%%PANEL%%', Rect(X, Y, W, H, { fill: C.panel, stroke: C.line }) + Ln(X + W, Y, X + W, Y + H, C.cyan, { op: 0.7, filter: 'glow' }));
  s += Ln(x, Y + H - 50, xr, Y + H - 50, C.line) + T(x, Y + H - 26, 'slew   start sequence   log session', { size: 10, fill: C.dim }) + T(xr, Y + H - 26, 'say or ⌘K', { size: 9.5, fill: C.ghost, anchor: 'end' });
  // callouts
  s += callout(1, cx + 236, cy + 40, 920, 860, ['core → orrery morph: rings tilt and resolve into', 'orbits, hubs re-seat, paths fade (~1.2s ease);', 'reverses on esc']);
  s += callout(2, ...rotp([cx + Math.cos(2.4) * 400, cy + Math.sin(2.4) * 400 * tilt]), 120, 820, ['slow orbit (minutes / rev) encodes real', 'time; no decorative spin']);
  s += callout(3, mx, my, 240, 160, ['target ray from parallax queue;', 'queued targets ghosted']);
  s += callout(4, 22, 450, 40, 680, ['other rails ghosted to ~15%'], 'start');
  s += callout(5, X, Y + 300, 1080, 300, ['astro rail awake: tonight window,', 'clouds, target, mount, camera']);
  write('astro-mode.html', page('04 astro mode', s));
}

// ============ FRAME 5: CMD-K over idle ============
{
  let s = grid() + brain(IDLE_BRAIN) + rails() + topChrome() + bottomChrome();
  s += `<rect width="1920" height="1080" fill="#000" opacity="0.55"/>`;
  const X = 600, W = 720, Y = 230; let y = Y;
  const rows = [
    ['astro.mount.slew', 'Slew mount to target…', 'APPROVAL', C.amber, true],
    ['astro.mount.park', 'Park mount', 'APPROVAL', C.amber],
    ['astro.mode', 'Enter Astro mode (mesh → orrery)', '', C.mid],
    ['knowledge.note.new', '“log tonight’s session”', '', C.mid],
    ['print.queue', 'Show PRO-1000 queue', '', C.mid],
    ['dev.prs.open', 'Open pull requests', '', C.mid],
  ];
  const H = 70 + rows.length * 40 + 44;
  s += Rect(X, Y, W, H, { fill: C.panel, stroke: '#2a2f35' }) + Ln(X, Y, X + W, Y, C.cyan, { op: 0.7, filter: 'glow' });
  s += T(X + 22, Y + 40, '›', { size: 18, fill: C.cyan }) + T(X + 46, Y + 40, 'slew m', { size: 16, fill: C.ink, weight: 400 }) + `<rect x="${X + 46 + 6 * 9.7}" y="${Y + 25}" width="9" height="19" fill="${C.cyan}" opacity="0.8"/>`;
  s += T(X + W - 22, Y + 40, '⌘K', { size: 10, fill: C.dim, anchor: 'end' }) + Ln(X, Y + 62, X + W, Y + 62, C.line);
  y = Y + 62;
  rows.forEach(([id, desc, badge, col, sel], i) => {
    const ry = y + i * 40;
    if (sel) s += `<rect x="${X + 1}" y="${ry + 4}" width="${W - 2}" height="34" fill="#0e1114"/>` + Ln(X + 1, ry + 4, X + 1, ry + 38, C.cyan, { w: 2, filter: 'glow' });
    s += T(X + 22, ry + 26, id, { size: 11, fill: sel ? C.cyan : C.mid }) + T(X + 230, ry + 26, desc, { size: 11, fill: sel ? C.ink : C.dim });
    if (badge) s += Rect(X + W - 100, ry + 13, 78, 18, { stroke: col, op: sel ? 1 : 0.5 }) + T(X + W - 61, ry + 26, badge, { size: 9, fill: col, anchor: 'middle', ls: 1, op: sel ? 1 : 0.6 });
  });
  const fy = Y + H - 16; s += Ln(X, fy - 26, X + W, fy - 26, C.line);
  s += T(X + 22, fy, '↑↓ select   ⏎ run   esc close', { size: 9.5, fill: C.dim }) + T(X + W - 22, fy, 'same tool layer as voice + buttons', { size: 9.5, fill: C.dim, anchor: 'end' });
  s += frameTag('WF-05', 'CMD-K PALETTE');
  s += callout(1, X + W, Y + 40, 1360, 250, ['typed fallback to voice; fuzzy match', 'on tool ids + plain-language']);
  s += callout(2, X + W - 61, Y + 62 + 22, 1360, 330, ['risk badge: approval prompt still', 'appears before physical actions']);
  s += callout(3, X, Y + H / 2, 220, 400, ['console dims behind; brain', 'keeps idling (no state change)']);
  s += callout(4, X + 300, fy, 760, 640, ['only modal surface allowed; centered, single column']);
  write('cmdk.html', page('05 cmd-k', s));
}
console.log('nodes', nodes.length, 'links', links.length);
if (process.env.DEBUG) fs.writeFileSync('/tmp/graph-debug.html', page('debug', grid() + brain({ nodeOp: 0.9, edgeOp: 0.35 })));
