'use strict';

// Updates come from GitHub Releases.
// - Installed app: downloads a new version in the background and installs it
//   the next time the app closes, or right away from the "Restart" button.
// - Portable .exe: can't replace itself, so it only says a new version is out.
// Offline or any other error: stay quiet, the app works the same without updates.

const { app, ipcMain, shell, net } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = 'itslxmns/TreeMapDisk';
const RELEASES_URL = `https://github.com/${REPO}/releases/latest`;
const FIRST_CHECK_MS = 4000;

let downloaded = false;

function isNewer(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  }
  return false;
}

async function checkPortable(send) {
  try {
    const res = await net.fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { 'User-Agent': 'Disk-Treemap', Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return;
    const { tag_name: tag } = await res.json();
    const latest = String(tag || '').replace(/^v/, '');
    if (latest && isNewer(latest, app.getVersion())) send('update-status', { state: 'portable', version: latest });
  } catch {
    // offline: say nothing
  }
}

function setupUpdates(send) {
  ipcMain.handle('install-update', () => {
    if (downloaded) require('electron-updater').autoUpdater.quitAndInstall(true, true);
  });
  ipcMain.handle('open-releases', () => shell.openExternal(RELEASES_URL));

  // Dev only: DT_UPDATE_FEED=http://localhost:port points at a folder of built release files.
  const devFeed = process.env.DT_UPDATE_FEED;
  if (!app.isPackaged && !devFeed) return;

  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    setTimeout(() => checkPortable(send), FIRST_CHECK_MS);
    return;
  }

  const { autoUpdater } = require('electron-updater');
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = !devFeed; // never install from a dev test run
  autoUpdater.logger = devFeed ? console : null;
  if (devFeed) {
    const cfg = path.join(os.tmpdir(), 'disk-treemap-dev-app-update.yml');
    fs.writeFileSync(cfg, `provider: generic
url: ${devFeed}
updaterCacheDirName: disk-treemap-updater-dev
`);
    autoUpdater.forceDevUpdateConfig = true;
    autoUpdater.updateConfigPath = cfg;
  }
  autoUpdater.on('update-downloaded', (info) => {
    downloaded = true;
    send('update-status', { state: 'ready', version: info.version });
  });
  autoUpdater.on('error', () => {});
  setTimeout(() => {
    autoUpdater.checkForUpdates()
      .then((r) => r && r.downloadPromise && r.downloadPromise.catch(() => {}))
      .catch(() => {});
  }, FIRST_CHECK_MS);
}

module.exports = { setupUpdates };
