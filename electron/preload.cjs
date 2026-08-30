const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  openExternal: (url) => ipcRenderer.invoke('external:open', url),
  windowControls: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
    onChange: (callback) => {
      const listener = (_event, state) => callback(state);
      ipcRenderer.on('window-state-changed', listener);

      return () => {
        ipcRenderer.removeListener('window-state-changed', listener);
      };
    },
  },
});
