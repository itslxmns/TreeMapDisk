'use strict';

const $ = (id) => document.getElementById(id);
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
const bold = (text) => el('b', null, text);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- categories ----------
const CATS = [
  { id: 'junk', label: 'Clutter', c: ['#ee6c2b', '#e2611f'] },
  { id: 'video', label: 'Video', c: ['#8a7fd0', '#7f74c4'], ext: 'mp4 mkv mov avi webm wmv flv m4v ts m2ts' },
  { id: 'images', label: 'Images', c: ['#4ea398', '#46978c'], ext: 'png jpg jpeg gif webp bmp tga tif tiff psd svg ico exr hdr dds heic raw kra avif' },
  { id: 'audio', label: 'Audio', c: ['#c2728c', '#b66881'], ext: 'mp3 wav flac ogg m4a aac wma opus' },
  { id: 'archives', label: 'Archives', c: ['#c49a45', '#b88f3b'], ext: 'zip rar 7z tar gz bz2 xz iso cab tgz' },
  { id: 'models', label: '3D & Games', c: ['#5a8fc4', '#5084b8'], ext: 'blend blend1 fbx obj glb gltf stl rbxl rbxlx rbxm rbxmx max ma mb usd usdz abc unitypackage uasset' },
  { id: 'code', label: 'Code', c: ['#7b84c6', '#717aba'], ext: 'js mjs cjs ts tsx jsx py cs lua luau c cpp h hpp rs go java json html css xml yml yaml toml sh ps1 map' },
  { id: 'docs', label: 'Documents', c: ['#6c9f69', '#62935f'], ext: 'pdf doc docx txt md xls xlsx ppt pptx csv odt rtf epub' },
  { id: 'programs', label: 'Programs', c: ['#6e727b', '#666a72'], ext: 'exe dll msi sys bin so dylib pak dat db sqlite lib pdb jar wasm node vhdx' },
  { id: 'other', label: 'Other', c: ['#50535a', '#494c52'] },
];
const JUNK = 0;
const OTHER = CATS.length - 1;
const RISKY = ['#4a2c1f', '#432719']; // dark tile, ember stripes: clutter to check first
const EXT = new Map();
CATS.forEach((cat, i) => { if (cat.ext) for (const e of cat.ext.split(' ')) EXT.set(e, i); });

// Simple line icons (24x24, stroke-based) for the home screen cards.
const ICONS = {
  drive: 'M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 13h18M17 16h.01',
  home: 'M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z',
  desktop: 'M5 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM8 20h8M12 16v4',
  downloads: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  documents: 'M6 3h8l5 5v13H6zM14 3v5h5M9 13h7M9 17h7',
  pictures: 'M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM21 16l-5-5-9 9M9 8.5a1.5 1.5 0 1 0 0 .01',
  videos: 'M5 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM17 10l4-2v8l-4-2',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  plus: 'M12 5v14M5 12h14',
  locate: 'M12 19a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM12 2v3M12 19v3M2 12h3M19 12h3',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
};
function svgIcon(name) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', ICONS[name] || ICONS.folder);
  svg.append(path);
  return svg;
}
const QUIPS = [
  'Weighing every byte…', 'Peeking inside node_modules (it goes deep)…', 'Counting cat pictures…',
  'Asking folders how big they really are…', 'Untangling build folders…', 'Looking under the digital couch…',
  'Measuring with a very tiny ruler…', 'Finding where the gigabytes went…',
];

// ---------- state ----------
let rules = {};
let scan = null;
let view = null;
let hits = [];
let hover = null;
let selected = new Set();
let collapsed = new Set();
let lastRoot = null;
let busy = false;
let animating = false;

// ---------- helpers ----------
const nf = new Intl.NumberFormat('en-US');
function fmt(b) {
  if (b < 1024) return `${Math.round(b)} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let i = -1;
  do { b /= 1024; i++; } while (b >= 1024 && i < units.length - 1);
  return `${b.toFixed(b < 10 ? 2 : b < 100 ? 1 : 0)} ${units[i]}`;
}
function pct(part, whole) {
  if (!whole) return '0%';
  const p = (part / whole) * 100;
  if (p < 1) return '<1%';
  if (p >= 99.5 && part < whole) return '>99%';
  return `${Math.round(p)}%`;
}
function shade(hex, amt) {
  const v = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + amt * 255)));
  return `rgb(${f(v >> 16)},${f((v >> 8) & 255)},${f(v & 255)})`;
}
function link(n, parent) {
  n.p = parent;
  if (n.c) for (const c of n.c) link(c, n);
}
function fullPath(n) {
  const parts = [];
  for (let x = n; x.p; x = x.p) parts.push(x.n);
  let p = scan.root;
  for (let i = parts.length - 1; i >= 0; i--) p = p.endsWith(scan.sep) ? p + parts[i] : p + scan.sep + parts[i];
  return p;
}
function relPath(n) {
  return fullPath(n).slice(scan.root.length).replace(/^[\\/]/, '') || '.';
}
function nameOf(n) { return n.p ? n.n : n.n.replace(/[\\/]$/, '') || n.n; }
function collectJunk() {
  const out = [];
  (function walk(n) {
    if (n.j) { out.push(n); return; }
    if (n.c) n.c.forEach(walk);
  })(scan.tree);
  return out;
}

// ---------- per-folder category totals ----------
function leafCat(n) {
  if (n.j) return JUNK;
  if (n.other || n.d) return OTHER;
  const dot = n.n.lastIndexOf('.');
  const i = dot > 0 ? EXT.get(n.n.slice(dot + 1).toLowerCase()) : undefined;
  return i === undefined ? OTHER : i;
}
function isFolder(n) { return n.d && !n.j && n.c; }
function computeK(n) {
  const k = new Float64Array(CATS.length);
  for (const c of n.c) {
    if (isFolder(c)) {
      computeK(c);
      for (let i = 0; i < k.length; i++) k[i] += c.k[i];
    } else {
      k[leafCat(c)] += c.s;
    }
  }
  n.k = k;
}
function kOf(n) {
  if (n.k) return n.k;
  const k = new Float64Array(CATS.length);
  k[leafCat(n)] = n.s;
  return k;
}
function dominant(n) {
  const k = kOf(n);
  let best = OTHER;
  for (let i = 0; i < k.length; i++) if (k[i] > k[best]) best = i;
  return best;
}
// Short label shown at the top of a tile, like "Folder" or "Clutter"
function kindOf(n) {
  if (n.j) return rules[n.j] && rules[n.j].safe ? 'Clutter' : 'Clutter, check first';
  if (n.virt || n.other) return 'Grouped';
  if (isFolder(n)) return 'Folder';
  return CATS[leafCat(n)].label;
}
// A folder is never painted ember: that color only marks clutter you can delete.
function folderCat(n) {
  const k = kOf(n);
  let best = OTHER;
  for (let i = 1; i < k.length; i++) if (k[i] > k[best]) best = i;
  return k[best] > 0 ? best : OTHER;
}
function colorsOf(n) {
  if (n.j) return rules[n.j] && rules[n.j].safe ? CATS[JUNK].c : RISKY;
  if (n.virt || n.other) return ['#3a3c41', '#34363b'];
  return CATS[isFolder(n) ? folderCat(n) : leafCat(n)].c;
}

// ---------- squarified layout ----------
function squarify(values, x, y, w, h) {
  const out = new Array(values.length);
  const total = values.reduce((a, b) => a + b, 0);
  if (total <= 0 || w <= 0 || h <= 0) return out;
  const scale = (w * h) / total;
  const areas = values.map((v) => v * scale);
  let i = 0;
  while (i < areas.length) {
    const side = Math.min(w, h);
    if (side <= 0) break;
    let j = i;
    let sum = 0;
    let best = Infinity;
    while (j < areas.length) {
      const s = sum + areas[j];
      const worst = Math.max((side * side * areas[i]) / (s * s), (s * s) / (side * side * areas[j]));
      if (worst > best) break;
      best = worst;
      sum = s;
      j++;
    }
    if (w >= h) {
      const cw = sum / h;
      let cy = y;
      for (let k = i; k < j; k++) { const rh = areas[k] / cw; out[k] = [x, cy, cw, rh]; cy += rh; }
      x += cw; w -= cw;
    } else {
      const rh = sum / w;
      let cx = x;
      for (let k = i; k < j; k++) { const cw = areas[k] / rh; out[k] = [cx, y, cw, rh]; cx += cw; }
      y += rh; h -= rh;
    }
    i = j;
  }
  return out;
}

// One level at a time, at most ~36 tiles; the long tail becomes one "small items" tile.
const MAX_TILES = 36;
const MIN_SHARE = 0.006;
function tilesFor(node) {
  const kids = (node.c || []).filter((c) => c.s > 0);
  const out = [];
  const rest = [];
  for (const c of kids) {
    if (out.length < MAX_TILES && c.s / node.s >= MIN_SHARE) out.push(c); else rest.push(c);
  }
  if (rest.length === 1) out.push(rest[0]);
  else if (rest.length) {
    out.push({ n: `${nf.format(rest.length)} small items`, s: rest.reduce((a, c) => a + c.s, 0), virt: true, items: rest, p: node });
  }
  return out.sort((a, b) => b.s - a.s);
}

// ---------- canvas ----------
const base = $('base');
const overlay = $('overlay');
const bctx = base.getContext('2d');
const octx = overlay.getContext('2d');
let W = 0;
let H = 0;
let dpr = 1;

function measure() {
  dpr = window.devicePixelRatio || 1;
  const r = $('mapWrap').getBoundingClientRect();
  W = r.width;
  H = r.height;
  for (const [c, ctx] of [[base, bctx], [overlay, octx]]) {
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

function fitText(ctx, text, maxW) {
  if (maxW <= 0) return '';
  if (ctx.measureText(text).width <= maxW) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ctx.measureText(`${text.slice(0, mid)}…`).width <= maxW) lo = mid; else hi = mid - 1;
  }
  return lo > 0 ? `${text.slice(0, lo)}…` : '';
}

const GAP = 2; // 4px between tiles
const FONT = '"Segoe UI Variable Text", "Segoe UI", sans-serif';
const DISPLAY = '"Segoe UI Variable Display", "Segoe UI", sans-serif';

// Pick dark or light text, whichever reads better on this tile color.
function luminance(hex) {
  const v = parseInt(hex.slice(1), 16);
  const ch = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * ch(v >> 16) + 0.7152 * ch((v >> 8) & 255) + 0.0722 * ch(v & 255);
}
function inkOn(hex) {
  const L = luminance(hex);
  const vsWhite = 1.05 / (L + 0.05);
  const vsDark = (L + 0.05) / 0.057;
  return vsDark > vsWhite ? ['#141415', 'rgba(20,20,21,0.72)'] : ['#ffffff', 'rgba(255,255,255,0.76)'];
}

// Hazard tape: the one signature mark for clutter.
function hazard(ctx, x, y, w, h, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 7;
  ctx.beginPath();
  for (let s = -h; s < w; s += 20) { ctx.moveTo(x + s, y + h); ctx.lineTo(x + s + h, y); }
  ctx.stroke();
}

function drawTile(ctx, n, x, y, w, h, parent) {
  x += GAP; y += GAP; w -= GAP * 2; h -= GAP * 2;
  if (w < 1.5 || h < 1.5) return null;
  const r = Math.max(2, Math.min(8, w / 4, h / 4));
  const [c1, c2] = colorsOf(n);
  const folder = isFolder(n);
  const risky = n.j && !(rules[n.j] && rules[n.j].safe);

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  const g = ctx.createLinearGradient(x, y, x, y + h); // small tone shift inside one hue
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.clip();
  if (n.j) hazard(ctx, x, y, w, h, risky ? 'rgba(238,108,43,0.30)' : 'rgba(26,13,5,0.16)');
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  // folder: what it's made of, as a thin bar along the bottom
  if (folder && w > 96 && h > 96) {
    const k = n.k;
    const bx = x + 16;
    const bw = w - 32;
    const by = y + h - 20;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, 4, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fill();
    ctx.clip();
    let cx = bx;
    for (let i = 0; i < k.length; i++) {
      if (!k[i]) continue;
      const sw = (k[i] / n.s) * bw;
      ctx.fillStyle = i === JUNK ? '#f6a57a' : shade(CATS[i].c[0], 0.12);
      ctx.fillRect(cx, by, sw, 4);
      cx += sw;
    }
    ctx.restore();
  }

  // labels: kind, name, size
  const [ink, ink2] = inkOn(risky ? '#4a2c1f' : c1);
  ctx.textBaseline = 'top';
  const share = pct(n.s, parent.s);
  const pad = w > 160 && h > 120 ? 16 : 8;
  const nameSize = Math.max(14, Math.min(28, Math.round(Math.sqrt(w * h) / 14)));
  if (w >= 96 && h >= nameSize + 64) {
    ctx.font = `500 12px ${FONT}`;
    ctx.fillStyle = ink2;
    ctx.fillText(fitText(ctx, kindOf(n), w - pad * 2), x + pad, y + pad);
    ctx.font = `500 ${nameSize}px ${DISPLAY}`;
    ctx.fillStyle = ink;
    ctx.fillText(fitText(ctx, n.n, w - pad * 2), x + pad, y + pad + 20);
    ctx.font = `400 13px ${FONT}`;
    ctx.fillStyle = ink2;
    ctx.fillText(fitText(ctx, `${fmt(n.s)} · ${share}`, w - pad * 2), x + pad, y + pad + 28 + nameSize);
  } else if (w >= 56 && h >= 40) {
    ctx.font = `500 12px ${FONT}`;
    ctx.fillStyle = ink;
    ctx.fillText(fitText(ctx, n.n, w - 16), x + 8, y + 8);
    ctx.font = `400 12px ${FONT}`;
    ctx.fillStyle = ink2;
    ctx.fillText(fitText(ctx, fmt(n.s), w - 16), x + 8, y + 24);
  }
  ctx.restore();
  return { n, x, y, w, h, r };
}

function paint(ctx, node) {
  ctx.clearRect(0, 0, W, H);
  const tiles = tilesFor(node);
  const rects = squarify(tiles.map((t) => t.s), 4, 4, W - 8, H - 8);
  const out = [];
  tiles.forEach((t, i) => {
    const r = rects[i];
    if (!r) return;
    const hit = drawTile(ctx, t, r[0], r[1], r[2], r[3], node);
    if (hit) out.push(hit);
  });
  return out;
}

function render() {
  if (!view) return;
  measure();
  hits = paint(bctx, view);
  drawOverlay();
}

function drawOverlay() {
  octx.clearRect(0, 0, W, H);
  if (!hover || animating) return;
  const { x, y, w, h, r } = hover;
  octx.save();
  octx.beginPath();
  octx.roundRect(x, y, w, h, r);
  octx.fillStyle = 'rgba(255,255,255,0.06)';
  octx.fill();
  octx.lineWidth = 1.5;
  octx.strokeStyle = 'rgba(255,255,255,0.9)';
  octx.stroke();
  octx.restore();
}

function hitTest(px, py) {
  for (const h of hits) if (px >= h.x && px < h.x + h.w && py >= h.y && py < h.y + h.h) return h;
  return null;
}

// ---------- zoom animation ----------
const lerp = (a, b, t) => a + (b - a) * t;
const lerpRect = (a, b, t) => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t) });
const full = () => ({ x: 0, y: 0, w: W, h: H });
const blowUp = (r) => { const sx = W / r.w; const sy = H / r.h; return { x: -r.x * sx, y: -r.y * sy, w: W * sx, h: H * sy }; };

function setView(n, mode, rect) {
  const old = view;
  view = n;
  hover = null;
  hideTip();
  updateChrome();
  if (!old || !mode || reducedMotion || !W) { render(); return; }

  // Paint the old and new views into offscreen canvases, then fly between them.
  measure();
  const snap = document.createElement('canvas');
  snap.width = base.width; snap.height = base.height;
  const sctx = snap.getContext('2d');
  sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  paint(sctx, old);

  const next = document.createElement('canvas');
  next.width = base.width; next.height = base.height;
  const nctx = next.getContext('2d');
  nctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  hits = paint(nctx, view);

  let from = rect;
  if (mode === 'out') {
    let c = old;
    while (c && c.p !== view) c = c.p;
    const h = hits.find((x) => x.n === c);
    from = h || null;
  }

  animating = true;
  const t0 = performance.now();
  const D = 380;
  const frame = (t) => {
    const p = Math.min(1, (t - t0) / D);
    const e = 1 - Math.pow(1 - p, 3);
    bctx.clearRect(0, 0, W, H);
    const draw = (img, r, a) => { bctx.globalAlpha = Math.max(0, Math.min(1, a)); bctx.drawImage(img, r.x, r.y, r.w, r.h); };
    if (from && mode === 'in') {
      draw(snap, lerpRect(full(), blowUp(from), e), 1 - e * 1.2);
      draw(next, lerpRect(from, full(), e), 0.2 + e);
    } else if (from && mode === 'out') {
      draw(next, lerpRect(blowUp(from), full(), e), 0.2 + e);
      draw(snap, lerpRect(full(), from, e), 1 - e * 1.2);
    } else {
      draw(snap, full(), 1 - e);
      draw(next, full(), e);
    }
    bctx.globalAlpha = 1;
    if (p < 1) requestAnimationFrame(frame);
    else { animating = false; render(); }
  };
  requestAnimationFrame(frame);
}

function goUp() {
  if (view && view.p && !animating) setView(view.p, 'out');
}

// ---------- story header ----------
function renderStory() {
  const box = $('headline');
  box.textContent = '';
  const kids = (view.c || []).filter((c) => c.s > 0);
  const line1 = el('div');
  if (!kids.length) {
    line1.append('This folder is empty.');
  } else {
    const top = kids[0];
    const share = top.s / view.s;
    const what = share > 0.5 ? ' takes up ' : ' is the biggest thing here: ';
    line1.append(bold(top.n), what, bold(pct(top.s, view.s)), ' of ', bold(nameOf(view)), ` (${fmt(top.s)})`);
  }
  const junkHere = kOf(view)[JUNK];
  const line2 = el('div', 'line2');
  if (junkHere > 0) line2.append(bold(fmt(junkHere)), ' of this is clutter that tools can rebuild, marked with stripes');
  else line2.append('No clutter here, everything in this folder is your own stuff');
  box.append(line1, line2);

  const k = kOf(view);
  const order = [...k.keys()].filter((i) => k[i] > 0).sort((a, b) => k[b] - k[a]);
  const bar = $('compBar');
  bar.textContent = '';
  const legend = $('compLegend');
  legend.textContent = '';
  for (const i of order) {
    const seg = el('div');
    seg.style.width = `${(k[i] / view.s) * 100}%`;
    seg.style.background = CATS[i].c[0];
    if (i === JUNK) seg.className = 'striped';
    seg.title = `${CATS[i].label}: ${fmt(k[i])} (${pct(k[i], view.s)})`;
    bar.append(seg);
  }
  for (const i of order.slice(0, 7)) {
    const chip = el('span');
    const dot = el('i');
    dot.style.background = CATS[i].c[0];
    if (i === JUNK) dot.className = 'striped';
    chip.append(dot, `${CATS[i].label} `, el('em', null, fmt(k[i])));
    legend.append(chip);
  }
}

function renderCrumbs() {
  const nav = $('crumbs');
  nav.textContent = '';
  if (!view) return;
  const chain = [];
  for (let x = view; x; x = x.p) chain.unshift(x);
  chain.forEach((node, idx) => {
    if (idx) nav.append(el('span', 'sep', '›'));
    const a = el('a', null, idx === 0 ? nameOf(node) : node.n);
    a.title = `${fullPath(node)} (${fmt(node.s)})`;
    a.onclick = () => { if (node !== view && !animating) setView(node, 'out'); };
    nav.append(a);
  });
}

function updateChrome() {
  renderCrumbs();
  renderStory();
  $('up').disabled = !view || !view.p;
}

// ---------- tooltip ----------
const tip = $('tip');
function hideTip() { tip.classList.add('hidden'); }
function showTip(h, mx, my) {
  const n = h.n;
  tip.textContent = '';
  const title = el('div', 't-title');
  const dot = el('i');
  dot.style.background = colorsOf(n)[0];
  if (n.j) dot.className = 'striped';
  title.append(dot, el('span', null, n.n));
  let kind;
  let hint;
  let hintCls = 't-hint';
  if (n.j) {
    const rule = rules[n.j];
    kind = `${rule.label}: ${rule.safe ? 'safe to delete' : 'check before deleting'}`;
    hint = selected.has(n) ? 'Selected for cleanup · click to unselect' : 'Click to select for cleanup';
    hintCls += ' junk';
  } else if (n.virt) {
    kind = 'Lots of small files and folders grouped together';
    hint = 'Too small to show one by one';
  } else if (n.other) {
    kind = 'Many small items grouped by the scanner';
    hint = '';
  } else if (isFolder(n)) {
    const d = CATS[dominant(n)];
    kind = `Folder · ${nf.format(n.f || 0)} files · mostly ${d.label.toLowerCase()}`;
    hint = 'Click to look inside';
  } else {
    kind = `${CATS[leafCat(n)].label} file`;
    hint = 'Right-click to show in Explorer';
  }
  const size = el('div', 't-size', fmt(n.s));
  size.append(el('em', null, `${pct(n.s, view.s)} of ${nameOf(view)}`));
  tip.append(title, el('div', 't-kind', kind), size);
  if (hint) tip.append(el('div', hintCls, hint));
  tip.classList.remove('hidden');
  const tw = tip.offsetWidth;
  const th = tip.offsetHeight;
  let tx = mx + 18;
  let ty = my + 18;
  if (tx + tw > W - 8) tx = mx - tw - 18;
  if (ty + th > H - 8) ty = my - th - 18;
  tip.style.left = `${Math.max(8, tx)}px`;
  tip.style.top = `${Math.max(8, ty)}px`;
}

// ---------- sidebar ----------
let shownFree = 0;
function animateNumber(target) {
  const elBig = $('freeBig');
  const from = shownFree;
  const t0 = performance.now();
  const step = (t) => {
    const p = Math.min(1, (t - t0) / 500);
    const e = 1 - Math.pow(1 - p, 3);
    shownFree = from + (target - from) * e;
    elBig.textContent = fmt(shownFree);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function updateSelection() {
  const list = [...selected];
  const total = list.reduce((a, n) => a + n.s, 0);
  const found = scan ? collectJunk().reduce((a, n) => a + n.s, 0) : 0;
  animateNumber(total);
  $('gaugeFill').style.width = scan && scan.tree.s ? `${Math.min(100, (total / scan.tree.s) * 100)}%` : '0';
  $('freeSub').textContent = scan
    ? `${list.length} of ${collectJunk().length} selected · ${pct(total, scan.tree.s)} of ${nameOf(scan.tree)}${found > total ? ` · ${fmt(found)} found` : ''}`
    : '';
  $('clean').textContent = list.length ? `Clean up ${fmt(total)}` : 'Clean up';
  $('clean').disabled = !list.length || busy;
}

function renderJunk() {
  const box = $('junk');
  box.textContent = '';
  if (!scan) return;
  const items = collectJunk();
  if (!items.length) {
    box.append(el('div', 'empty-note', 'No rebuildable clutter in this folder'));
    updateSelection();
    return;
  }
  const groups = new Map();
  for (const n of items) {
    if (!groups.has(n.j)) groups.set(n.j, []);
    groups.get(n.j).push(n);
  }
  const ordered = [...groups.entries()]
    .map(([id, list]) => ({ id, list: list.sort((a, b) => b.s - a.s), total: list.reduce((a, n) => a + n.s, 0) }))
    .sort((a, b) => b.total - a.total);

  for (const g of ordered) {
    const rule = rules[g.id] || { label: g.id, hint: '', safe: false };
    const group = el('div', `group${rule.safe ? '' : ' risky'}${collapsed.has(g.id) ? ' collapsed' : ''}`);
    const head = el('div', 'group-head');
    const all = el('input');
    all.type = 'checkbox';
    const nSel = g.list.filter((n) => selected.has(n)).length;
    all.checked = nSel === g.list.length;
    all.indeterminate = nSel > 0 && nSel < g.list.length;
    all.onclick = (e) => {
      e.stopPropagation();
      for (const n of g.list) { if (all.checked) selected.add(n); else selected.delete(n); }
      renderJunk();
    };
    const swatch = el('span', 'gi');
    head.append(all, swatch, el('span', 'name', rule.label),
      el('span', 'count', `×${g.list.length}`), el('span', 'size', fmt(g.total)));
    head.onclick = () => {
      if (collapsed.has(g.id)) collapsed.delete(g.id); else collapsed.add(g.id);
      group.classList.toggle('collapsed');
    };

    const list = el('div', 'items');
    for (const n of g.list) {
      const row = el('label', 'item');
      row._node = n;
      const cb = el('input');
      cb.type = 'checkbox';
      cb.checked = selected.has(n);
      cb.onchange = () => { if (cb.checked) selected.add(n); else selected.delete(n); renderJunk(); };
      const p = el('span', 'path', `‎${relPath(n)}‎`);
      p.title = fullPath(n);
      const find = el('button');
      find.append(svgIcon('locate'));
      find.title = 'Show in treemap';
      find.onclick = (e) => { e.preventDefault(); showScreen('explore'); setView(n.p); };
      const show = el('button');
      show.append(svgIcon('external'));
      show.title = 'Show in Explorer';
      show.onclick = (e) => { e.preventDefault(); window.api.reveal(fullPath(n)); };
      row.append(cb, p, el('span', 'size', fmt(n.s)), find, show);
      list.append(row);
    }
    group.append(head, el('div', 'group-hint', rule.hint), list);
    box.append(group);
  }
  updateSelection();
}

function focusJunk(n) {
  collapsed.delete(n.j);
  renderJunk();
  for (const row of document.querySelectorAll('.item')) {
    if (row._node === n) {
      row.scrollIntoView({ block: 'center', behavior: 'smooth' });
      row.classList.add('flash');
      break;
    }
  }
}

function removeNode(n) {
  const p = n.p;
  if (!p) return;
  const i = p.c.indexOf(n);
  if (i >= 0) p.c.splice(i, 1);
  const k = kOf(n);
  for (let a = p; a; a = a.p) {
    a.s -= n.s;
    a.f -= n.f || 0;
    for (let j = 0; j < k.length; j++) a.k[j] -= k[j];
  }
}

async function clean() {
  const nodes = [...selected];
  if (!nodes.length) return;
  busy = true;
  updateSelection();
  setStatus('Waiting for confirmation…');
  const byPath = new Map(nodes.map((n) => [fullPath(n), n]));
  try {
    const res = await window.api.trash(nodes.map((n) => ({ path: fullPath(n), size: n.s })));
    if (res.cancelled) { setStatus('Cleanup cancelled'); return; }
    let freed = 0;
    const failed = [];
    for (const r of res.results) {
      const n = byPath.get(r.path);
      if (r.ok && n) { freed += n.s; removeNode(n); selected.delete(n); } else failed.push(r);
    }
    render();
    updateChrome();
    renderJunk();
    if (freed > 0) {
      confetti();
      toast(`Moved ${fmt(freed)} to the Recycle Bin`);
      askForStar(freed);
    }
    setStatus(failed.length
      ? `Freed ${fmt(freed)}. ${failed.length} item(s) could not be moved: ${failed[0].error}`
      : `Freed ${fmt(freed)}`);
  } finally {
    busy = false;
    updateSelection();
  }
}

// ---------- fun stuff ----------
function setStatus(text) { $('status').textContent = text; }

let toastTimer = 0;
function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 4200);
}

function confetti() {
  if (reducedMotion) return;
  const c = $('confetti');
  const ctx = c.getContext('2d');
  const r = window.devicePixelRatio || 1;
  c.width = innerWidth * r;
  c.height = innerHeight * r;
  ctx.setTransform(r, 0, 0, r, 0, 0);
  const colors = ['#ee6c2b', '#f6a57a', '#ededed', '#a1a1a6', '#4ea398', '#c49a45'];
  const parts = Array.from({ length: 120 }, () => ({
    x: innerWidth - 200 + (Math.random() - 0.5) * 160,
    y: innerHeight - 80,
    vx: (Math.random() - 0.75) * 14,
    vy: -Math.random() * 16 - 8,
    s: Math.random() * 7 + 4,
    rot: Math.random() * 6,
    vr: (Math.random() - 0.5) * 0.4,
    color: colors[(Math.random() * colors.length) | 0],
  }));
  const t0 = performance.now();
  const frame = (t) => {
    const age = t - t0;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.42; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - age / 1800);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      ctx.restore();
    }
    if (age < 1800) requestAnimationFrame(frame); else ctx.clearRect(0, 0, innerWidth, innerHeight);
  };
  requestAnimationFrame(frame);
}

// ---------- "star on GitHub" ----------
// Asked once, right after a cleanup that actually freed space. Never again once answered.
const STAR_KEY = 'starAnswered';
function askForStar(freed) {
  if (localStorage.getItem(STAR_KEY)) return;
  $('starFreed').textContent = fmt(freed);
  $('starCard').classList.remove('hidden');
}
function answerStar(yes) {
  localStorage.setItem(STAR_KEY, yes ? 'starred' : 'later');
  $('starCard').classList.add('hidden');
  if (yes) {
    window.api.openRepo();
    toast('Thanks, that helps a lot');
  }
}
$('starYes').onclick = () => answerStar(true);
$('starNo').onclick = () => answerStar(false);
$('starBtn').onclick = () => window.api.openRepo();

// ---------- updates ----------
window.api.onUpdate(({ state, version }) => {
  const box = $('update');
  const btn = $('updateBtn');
  if (state === 'ready') {
    $('updateText').textContent = `Version ${version} is ready`;
    btn.textContent = 'Restart to update';
    btn.onclick = () => window.api.installUpdate();
  } else if (state === 'portable') {
    $('updateText').textContent = `Version ${version} is out`;
    btn.textContent = 'Download';
    btn.onclick = () => window.api.openReleases();
  } else {
    return;
  }
  box.classList.remove('hidden');
});

// ---------- screens ----------
function showScreen(name) {
  $('homeView').classList.toggle('hidden', name !== 'home');
  $('scanView').classList.toggle('hidden', name !== 'scan');
  $('exploreView').classList.toggle('hidden', name !== 'explore');
  $('side').classList.toggle('hidden', name !== 'explore');
  $('rescan').classList.toggle('hidden', !lastRoot || name === 'scan');
  $('crumbs').classList.toggle('hidden', name !== 'explore');
  $('up').classList.toggle('hidden', name !== 'explore');
  if (name === 'home') renderResume();
  if (name === 'explore') requestAnimationFrame(render);
}

function card(icon, title, sub, onClick, barPct) {
  const b = el('button', 'card');
  const ico = el('span', 'ico');
  ico.append(svgIcon(icon));
  b.append(ico, el('span', 'title', title));
  if (barPct != null) {
    const bar = el('div', `bar${barPct > 0.9 ? ' warn' : ''}`);
    const fill = el('div');
    fill.style.width = `${Math.round(barPct * 100)}%`;
    bar.append(fill);
    b.append(bar);
  }
  if (sub) b.append(el('span', 'sub', sub));
  b.onclick = onClick;
  return b;
}

function renderResume() {
  const box = $('resume');
  box.textContent = '';
  box.classList.toggle('hidden', !scan);
  if (!scan) return;
  const b = el('button', null, `Back to ${scan.root} · ${fmt(scan.tree.s)}`);
  b.onclick = () => showScreen('explore');
  box.append(b);
}

async function renderHome() {
  const drives = await window.api.listDrives();
  const dBox = $('drives');
  dBox.textContent = '';
  for (const d of drives) {
    const used = d.total ? (d.total - d.free) / d.total : null;
    const sub = d.total ? `${fmt(d.free)} free of ${fmt(d.total)}` : 'Size unknown';
    dBox.append(card('drive', d.path.replace(/\\$/, ''), sub, () => startScan(d.path), used));
  }
  const places = await window.api.listPlaces();
  const pBox = $('places');
  pBox.textContent = '';
  for (const p of places) {
    const label = p.id[0].toUpperCase() + p.id.slice(1);
    pBox.append(card(p.id, label, p.path, () => startScan(p.path)));
  }
  pBox.append(card('plus', 'Other folder', 'Choose any folder to scan', pickAndScan));
}

// ---------- scanning ----------
function startScan(root) { if (root) window.api.startScan(root); }
async function pickAndScan() { startScan(await window.api.pickFolder()); }

let quipTimer = 0;
window.api.onScanStarted(({ root }) => {
  lastRoot = root;
  showScreen('scan');
  $('scanFiles').textContent = '0';
  $('scanBytes').textContent = '0 B so far';
  $('scanPath').textContent = root;
  let qi = (Math.random() * QUIPS.length) | 0;
  $('quip').textContent = QUIPS[qi];
  clearInterval(quipTimer);
  quipTimer = setInterval(() => { qi = (qi + 1) % QUIPS.length; $('quip').textContent = QUIPS[qi]; }, 2400);
  setStatus(`Scanning ${root}…`);
});

window.api.onProgress((d) => {
  $('scanFiles').textContent = nf.format(d.files);
  $('scanBytes').textContent = `${fmt(d.bytes)} so far · ${nf.format(d.dirs)} folders`;
  $('scanPath').textContent = d.current;
});

window.api.onDone((d) => {
  clearInterval(quipTimer);
  scan = d;
  link(scan.tree, null);
  computeK(scan.tree);
  selected = new Set(collectJunk().filter((n) => rules[n.j] && rules[n.j].safe));
  collapsed = new Set();
  shownFree = 0;
  view = null;
  showScreen('explore');
  setView(scan.tree);
  renderJunk();
  const skipped = d.stats.errors ? ` · ${nf.format(d.stats.errors)} items skipped (no permission)` : '';
  setStatus(`Scanned ${nf.format(d.stats.files)} files (${fmt(d.tree.s)}) in ${(d.stats.ms / 1000).toFixed(1)} s${skipped}`);
});

window.api.onError((msg) => {
  clearInterval(quipTimer);
  showScreen(scan ? 'explore' : 'home');
  setStatus(`Scan failed: ${msg}`);
});

// ---------- events ----------
overlay.addEventListener('mousemove', (e) => {
  if (animating) return;
  const h = hitTest(e.offsetX, e.offsetY);
  if (h !== hover) { hover = h; drawOverlay(); }
  if (h) showTip(h, e.offsetX, e.offsetY); else hideTip();
});
overlay.addEventListener('mouseleave', () => { hover = null; drawOverlay(); hideTip(); });

overlay.addEventListener('click', () => {
  if (!hover || animating) return;
  const h = hover;
  const n = h.n;
  if (n.j) {
    if (selected.has(n)) selected.delete(n); else selected.add(n);
    focusJunk(n);
    showTip(h, h.x + h.w / 2, h.y + h.h / 2);
    return;
  }
  if (isFolder(n) && n.c.length) setView(n, 'in', h);
});

overlay.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (hover && !hover.n.virt && !hover.n.other) window.api.reveal(fullPath(hover.n));
});
overlay.addEventListener('mouseup', (e) => { if (e.button === 3) goUp(); });
window.addEventListener('keydown', (e) => { if (e.key === 'Backspace' || e.key === 'Escape') goUp(); });

let resizeQueued = false;
new ResizeObserver(() => {
  if (resizeQueued || animating) return;
  resizeQueued = true;
  requestAnimationFrame(() => { resizeQueued = false; render(); });
}).observe($('mapWrap'));

$('pick').onclick = pickAndScan;
$('rescan').onclick = () => startScan(lastRoot);
$('homeBtn').onclick = () => { window.api.cancelScan(); clearInterval(quipTimer); showScreen('home'); renderHome(); };
$('cancel').onclick = () => {
  window.api.cancelScan();
  clearInterval(quipTimer);
  showScreen(scan ? 'explore' : 'home');
  setStatus('Scan cancelled');
};
$('up').onclick = goUp;
$('clean').onclick = clean;

// ---------- init ----------
(async () => {
  for (const r of await window.api.getRules()) rules[r.id] = r;
  showScreen('home');
  renderHome();
})();
