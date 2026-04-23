'use strict';

const { contextBridge } = require('electron');

// Expose a minimal API surface to the renderer process.
// This lets the Angular app detect it is running inside Electron
// without granting full Node.js access.
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
});
