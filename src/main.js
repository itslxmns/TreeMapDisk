'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { Worker } = require('node:worker_threads');
const { publicRules } = require('./junk');

// Dev helpers: `electron . --scan=D:\some\folder --screenshot=shot.png`
// scans on launch, saves a screenshot when done, then quits (used for the README image).
const arg = (name) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};
const autoScan = arg('scan');
const screenshotPath = arg('screenshot');

let win = null;
let worker = null;
let scanRoot = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1320,
    height: 820,
    minWidth: 860,
    minHeight: 520,
    backgroundColor: '#0a0d14',
    title: 'Disk Treemap',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
    },
  });
  win.removeMenu();
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  if (autoScan) win.webContents.once('did-finish-load', () => startScan(path.resolve(autoScan)));
  else if (screenshotPath) win.webContents.once('did-finish-load', () => setTimeout(saveScreenshot, 1500));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

function send(channel, data) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, data);
}

function stopWorker() {
  if (worker) {
    worker.terminate();
    worker = null;
  }
}

function startScan(root) {
  stopWorker();
  scanRoot = root;
  send('scan-started', { root });
  const w = new Worker(path.join(__dirname, 'scanner.js'), { workerData: { root } });
  worker = w;
  w.on('message', (msg) => {
    if (worker !== w) return; // a newer scan replaced this one
    if (msg.type === 'progress') send('scan-progress', msg);
    if (msg.type === 'done') {
      worker = null;
      send('scan-done', { root, sep: path.sep, tree: msg.tree, stats: msg.stats });
      if (screenshotPath) setTimeout(saveScreenshot, 1200);
    }
  });
  w.on('error', (err) => {
    if (worker === w) send('scan-error', String(err && err.message ? err.message : err));
  });
}

async function saveScreenshot() {
  // Dev only: run some page JS first (e.g. click a tile) to screenshot other states.
  const js = arg('eval');
  if (js && !app.isPackaged) {
    await win.webContents.executeJavaScript(js);
    await new Promise((r) => setTimeout(r, 900));
  }
  const img = await win.webContents.capturePage();
  fs.writeFileSync(path.resolve(screenshotPath), img.toPNG());
  app.quit();
}

function isInside(root, p) {
  const rel = path.relative(root, p);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function fmt(b) {
  if (b < 1024) return `${b} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let i = -1;
  do { b /= 1024; i++; } while (b >= 1024 && i < units.length - 1);
  return `${b.toFixed(b < 10 ? 2 : b < 100 ? 1 : 0)} ${units[i]}`;
}

ipcMain.handle('list-drives', () => {
  const roots = [];
  if (process.platform === 'win32') {
    for (let c = 67; c <= 90; c++) { // C..Z, skipping slow floppy letters
      const d = `${String.fromCharCode(c)}:\\`;
      try { fs.accessSync(d); roots.push(d); } catch { /* not present */ }
    }
  } else {
    roots.push('/');
  }
  return roots.map((d) => {
    try {
      const st = fs.statfsSync(d);
      return { path: d, total: st.blocks * st.bsize, free: st.bavail * st.bsize };
    } catch {
      return { path: d, total: 0, free: 0 };
    }
  });
});

ipcMain.handle('list-places', () => ['home', 'desktop', 'downloads', 'documents', 'pictures', 'videos']
  .map((id) => {
    try {
      const p = app.getPath(id);
      return fs.existsSync(p) ? { id, path: p } : null;
    } catch {
      return null;
    }
  })
  .filter(Boolean));

ipcMain.handle('pick-folder', async () => {
  const res = await dialog.showOpenDialog(win, {
    title: 'Choose a folder to scan',
    properties: ['openDirectory'],
  });
  return res.canceled ? null : res.filePaths[0];
});

ipcMain.handle('get-rules', () => publicRules);

const REPO_URL = 'https://github.com/itslxmns/TreeMapDisk';
ipcMain.handle('open-repo', () => shell.openExternal(REPO_URL));

ipcMain.handle('start-scan', (_e, root) => {
  if (typeof root === 'string' && root) startScan(root);
});

ipcMain.handle('cancel-scan', () => stopWorker());

ipcMain.handle('reveal', (_e, p) => {
  if (typeof p === 'string' && scanRoot && (p === scanRoot || isInside(scanRoot, p))) {
    shell.showItemInFolder(p);
  }
});

// Cleanup always goes to the Recycle Bin, never a permanent delete, and the
// confirmation lives here in the main process so the UI can't skip it.
ipcMain.handle('trash', async (_e, items) => {
  if (!Array.isArray(items) || !scanRoot) return { cancelled: true, results: [] };
  const valid = items.filter((i) => i && typeof i.path === 'string' && isInside(scanRoot, i.path));
  if (!valid.length) return { cancelled: true, results: [] };

  const total = valid.reduce((sum, i) => sum + (Number(i.size) || 0), 0);
  const preview = valid.slice(0, 12).map((i) => `${i.path}  (${fmt(Number(i.size) || 0)})`).join('\n');
  const more = valid.length > 12 ? `\n…and ${valid.length - 12} more` : '';
  const { response } = await dialog.showMessageBox(win, {
    type: 'warning',
    title: 'Confirm cleanup',
    message: `Move ${valid.length} item${valid.length === 1 ? '' : 's'} (${fmt(total)}) to the Recycle Bin?`,
    detail: `${preview}${more}\n\nYou can restore them from the Recycle Bin.`,
    buttons: ['Move to Recycle Bin', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
  });
  if (response !== 0) return { cancelled: true, results: [] };

  const results = [];
  for (const i of valid) {
    try {
      await shell.trashItem(i.path);
      results.push({ path: i.path, ok: true });
    } catch (err) {
      results.push({ path: i.path, ok: false, error: String(err && err.message ? err.message : err) });
    }
  }
  return { cancelled: false, results };
});
