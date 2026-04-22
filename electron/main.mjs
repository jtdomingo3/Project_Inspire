import { app, BrowserWindow } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';

let mainWindow = null;
let backendStop = async () => {};
let shuttingDown = false;

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

  const backendModule = await import('../backend/src/server.js');
  const server = await backendModule.startBackendServer({ port: 0, host: '127.0.0.1' });
  backendStop = backendModule.stopBackendServer;

  const address = server.address();
  if (!address || typeof address !== 'object') {
    throw new Error('Unable to resolve backend address.');
  }

  process.env.INSPIRE_API_BASE = `http://127.0.0.1:${address.port}`;
}

async function createMainWindow() {
  const preloadPath = path.join(app.getAppPath(), 'electron', 'preload.mjs');
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 720,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath
    }
  });

  const devUrl = process.env.INSPIRE_DEV_SERVER_URL;
  if (devUrl) {
    await mainWindow.loadURL(devUrl);
  } else {
    const indexPath = await resolveFrontendIndex();
    await mainWindow.loadFile(indexPath);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });
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

app.whenReady().then(async () => {
  await startEmbeddedBackend();
  await createMainWindow();
}).catch(async (error) => {
  console.error('Failed to start desktop app:', error);
  await shutdownBackend();
  app.exit(1);
});
