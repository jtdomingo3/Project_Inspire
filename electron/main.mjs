import { app, BrowserWindow } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

let mainWindow = null;
let backendStop = async () => {};
let shuttingDown = false;

const singleInstanceLock = app.requestSingleInstanceLock();
if (!singleInstanceLock) {
  app.quit();
}

app.on('second-instance', () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
});

async function copyDefaultReferences(sourceDir, targetDir) {
  await fs.mkdir(targetDir, { recursive: true });

  const sourceEntries = await fs.readdir(sourceDir).catch(() => []);
  const referenceFiles = sourceEntries.filter((name) => /\.(pdf|docx)$/i.test(name));

  for (const fileName of referenceFiles) {
    const sourcePath = path.join(sourceDir, fileName);
    const targetPath = path.join(targetDir, fileName);
    const exists = await fs.access(targetPath).then(() => true).catch(() => false);
    if (!exists) {
      await fs.copyFile(sourcePath, targetPath);
    }
  }
}

async function resolveFrontendIndex() {
  const appRoot = app.getAppPath();
  const candidates = [
    path.join(appRoot, 'frontend', 'dist', 'frontend', 'browser', 'index.html'),
    path.join(appRoot, 'frontend', 'dist', 'frontend', 'index.html')
  ];

  for (const candidate of candidates) {
    const exists = await fs.access(candidate).then(() => true).catch(() => false);
    if (exists) {
      return candidate;
    }
  }

  throw new Error('Frontend build output not found. Run "npm run build:frontend" before launching Electron.');
}

async function startEmbeddedBackend() {
  const runtimeRoot = path.join(app.getPath('userData'), 'runtime');
  const dataDir = path.join(runtimeRoot, 'data');
  const referenceDir = path.join(runtimeRoot, 'reference');

  await fs.mkdir(dataDir, { recursive: true });
  await copyDefaultReferences(path.join(app.getAppPath(), 'reference'), referenceDir);

  process.env.INSPIRE_RUNTIME_ROOT = runtimeRoot;
  process.env.INSPIRE_DATA_DIR = dataDir;
  process.env.INSPIRE_REFERENCE_DIR = referenceDir;
  process.env.INSPIRE_DB_PATH = path.join(dataDir, 'inspire.db');

  const backendEntryPath = app.isPackaged
    ? path.join(process.resourcesPath, 'backend', 'src', 'server.js')
    : path.join(app.getAppPath(), 'backend', 'src', 'server.js');
  const backendModule = await import(pathToFileURL(backendEntryPath).href);
  const preferredPort = Number(process.env.INSPIRE_EMBEDDED_BACKEND_PORT || 3002);

  let server;
  try {
    server = await backendModule.startBackendServer({ port: preferredPort, host: '127.0.0.1' });
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String((error).code) : '';
    if (code !== 'EADDRINUSE') {
      throw error;
    }

    console.warn(`Embedded backend port ${preferredPort} is in use. Falling back to a random port.`);
    server = await backendModule.startBackendServer({ port: 0, host: '127.0.0.1' });
  }
  backendStop = backendModule.stopBackendServer;

  const address = server.address();
  if (!address || typeof address !== 'object') {
    throw new Error('Unable to resolve backend address.');
  }

  process.env.INSPIRE_API_BASE = `http://127.0.0.1:${address.port}`;
}

async function createMainWindow() {
  const preloadPath = path.join(app.getAppPath(), 'electron', 'preload.mjs');
  const iconCandidates = [
    path.join(app.getAppPath(), 'frontend', 'public', 'icon.png'),
    path.join(app.getAppPath(), 'frontend', 'public', 'icon-taskbar.ico'),
    path.join(app.getAppPath(), 'frontend', 'public', 'favicon.ico')
  ];

  let windowIcon;
  for (const candidate of iconCandidates) {
    const exists = await fs.access(candidate).then(() => true).catch(() => false);
    if (exists) {
      windowIcon = candidate;
      break;
    }
  }

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 720,
    show: false,
    ...(windowIcon ? { icon: windowIcon } : {}),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath
    }
  });

  // Some dev-server states can delay ready-to-show; keep the window visible with safe fallbacks.
  let hasShownWindow = false;
  const showWindow = () => {
    if (!mainWindow || mainWindow.isDestroyed() || hasShownWindow) {
      return;
    }
    hasShownWindow = true;
    mainWindow.show();
    mainWindow.focus();
  };

  mainWindow.once('ready-to-show', showWindow);
  mainWindow.webContents.once('did-finish-load', showWindow);

  mainWindow.webContents.on('did-fail-load', (_event, code, description, validatedUrl) => {
    console.error('Window failed to load:', { code, description, validatedUrl });
    showWindow();
  });

  const devUrl = process.env.INSPIRE_DEV_SERVER_URL;
  if (devUrl) {
    const resolvedDevUrl = new URL(devUrl);
    const apiBase = process.env.INSPIRE_API_BASE || '';
    if (apiBase) {
      resolvedDevUrl.searchParams.set('inspireApiBase', apiBase);
    }
    await mainWindow.loadURL(resolvedDevUrl.toString());
  } else {
    const indexPath = await resolveFrontendIndex();
    await mainWindow.loadFile(indexPath);
  }

  setTimeout(showWindow, 3000);
}

async function shutdownBackend() {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  await backendStop().catch(() => {});
}

app.on('before-quit', (event) => {
  if (shuttingDown) {
    return;
  }

  event.preventDefault();
  shutdownBackend().finally(() => {
    app.quit();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', async () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    await createMainWindow();
    return;
  }

  mainWindow.show();
  mainWindow.focus();
});

if (singleInstanceLock) {
  app.whenReady().then(async () => {
    await startEmbeddedBackend();
    await createMainWindow();
  }).catch(async (error) => {
    console.error('Failed to start desktop app:', error);
    await shutdownBackend();
    app.exit(1);
  });
}
