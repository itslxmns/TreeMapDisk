'use strict';

// Runs in a worker thread so the UI never freezes, even on a whole drive.
// Produces a compact tree: { n: name, s: bytes, f: fileCount, d: 1 (dir), c: children, j: junkRuleId }

const { parentPort, workerData } = require('node:worker_threads');
const fs = require('node:fs');
const path = require('node:path');
const { classify } = require('./junk');

const MAX_CHILDREN = 400; // the rest of a folder's items get merged into one "smaller items" block

let files = 0;
let dirs = 0;
let bytes = 0;
let errors = 0;
let lastPost = 0;

function progress(current) {
  const now = Date.now();
  if (now - lastPost < 120) return;
  lastPost = now;
  parentPort.postMessage({ type: 'progress', files, dirs, bytes, current });
}

function readEntries(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    errors++;
    return null;
  }
}

function fileSize(p) {
  try {
    return fs.lstatSync(p).size;
  } catch {
    errors++;
    return 0;
  }
}

// Size-only walk, used inside junk folders: we just need the total, not the structure.
function measure(dir) {
  const entries = readEntries(dir);
  if (!entries) return { s: 0, f: 0 };
  let s = 0;
  let f = 0;
  for (const e of entries) {
    if (e.isSymbolicLink()) continue; // also skips Windows junctions: no double counting, no loops
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      dirs++;
      const r = measure(p);
      s += r.s;
      f += r.f;
    } else if (e.isFile()) {
      const z = fileSize(p);
      s += z;
      f++;
      files++;
      bytes += z;
    }
  }
  progress(dir);
  return { s, f };
}

function scan(dir, name) {
  const node = { n: name, s: 0, f: 0, d: 1, c: [] };
  const entries = readEntries(dir);
  if (!entries) {
    node.err = 1;
    return node;
  }
  const siblings = new Set(entries.map((e) => e.name.toLowerCase()));

  for (const e of entries) {
    if (e.isSymbolicLink()) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      dirs++;
      const rule = classify(e.name, siblings);
      const child = rule
        ? { n: e.name, d: 1, j: rule.id, ...measure(p) }
        : scan(p, e.name);
      node.c.push(child);
      node.s += child.s;
      node.f += child.f;
    } else if (e.isFile()) {
      const z = fileSize(p);
      files++;
      bytes += z;
      node.c.push({ n: e.name, s: z });
      node.s += z;
      node.f++;
    }
  }

  node.c.sort((a, b) => b.s - a.s);
  if (node.c.length > MAX_CHILDREN) {
    const rest = node.c.splice(MAX_CHILDREN);
    node.c.push({
      n: `${rest.length.toLocaleString()} smaller items`,
      s: rest.reduce((sum, x) => sum + x.s, 0),
      f: rest.reduce((sum, x) => sum + (x.f || 1), 0),
      other: 1,
    });
  }
  progress(dir);
  return node;
}

const started = Date.now();
const root = workerData.root;
const tree = scan(root, root);
parentPort.postMessage({
  type: 'done',
  tree,
  stats: { files, dirs, bytes, errors, ms: Date.now() - started },
});
