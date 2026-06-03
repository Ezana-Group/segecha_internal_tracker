const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  testDb: (dbUrl) => ipcRenderer.invoke('test-db', dbUrl),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config)
});
