'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const on = (channel) => (cb) => ipcRenderer.on(channel, (_e, data) => cb(data));

contextBridge.exposeInMainWorld('api', {
  listDrives: () => ipcRenderer.invoke('list-drives'),
  listPlaces: () => ipcRenderer.invoke('list-places'),
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  getRules: () => ipcRenderer.invoke('get-rules'),
  startScan: (root) => ipcRenderer.invoke('start-scan', root),
  cancelScan: () => ipcRenderer.invoke('cancel-scan'),
  trash: (items) => ipcRenderer.invoke('trash', items),
  reveal: (p) => ipcRenderer.invoke('reveal', p),
  onScanStarted: on('scan-started'),
  onProgress: on('scan-progress'),
  onDone: on('scan-done'),
  onError: on('scan-error'),
});
