import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('inspireDesktop', {
  apiBase: process.env.INSPIRE_API_BASE || '',
  appVersion: process.env.npm_package_version || '',
  platform: process.platform
});
