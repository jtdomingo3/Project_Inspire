'use strict';

const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow = null;
let backendProcess = null;
const BACKEND_PORT = 3000;

function startBackend() {
  return new Promise((resolve, reject) => {
    const appRoot = app.getAppPath();
    const backendDir = path.join(appRoot, 'backend');
    const backendScript = path.join(backendDir, 'src', 'server.js');

    backendProcess = spawn(process.execPath, [backendScript], {
      cwd: backendDir,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        PORT: String(BACKEND_PORT),
        NODE_ENV: process.env.NODE_ENV || 'production',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    backendProcess.stdout.on('data', (data) => {
      process.stdout.write('[backend] ' + data.toString());
    });

    backendProcess.stderr.on('data', (data) => {
      process.stderr.write('[backend] ' + data.toString());
    });

    backendProcess.on('error', (err) => {
      console.error('Failed to start backend process:', err.message);
      reject(err);
    });

    backendProcess.on('exit', (code, signal) => {
      if (code !== 0 && code !== null) {
        console.error(`Backend exited unexpectedly with code ${code} (signal: ${signal})`);
      }
    });

    waitForBackend(BACKEND_PORT).then(resolve).catch(reject);
  });
}

function waitForBackend(port, maxAttempts = 30) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    function checkHealth() {
      const req = http.get(
        { hostname: 'localhost', port, path: '/api/health', timeout: 1500 },
        (res) => {
          res.resume();
          if (res.statusCode === 200) {
            resolve();
          } else {
            scheduleRetry();
          }
        }
      );

      req.on('error', scheduleRetry);
      req.on('timeout', () => {
        req.destroy();
        scheduleRetry();
      });
    }

    function scheduleRetry() {
      attempts += 1;
      if (attempts >= maxAttempts) {
        reject(new Error(`Backend did not become ready after ${maxAttempts} attempts`));
        return;
      }
      setTimeout(checkHealth, 1000);
    }

    // First check after a short delay to give the process time to start
    setTimeout(checkHealth, 1500);
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
    title: 'Project INSPIRE',
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(`http://localhost:${BACKEND_PORT}`);
}

app.whenReady().then(async () => {
  try {
    await startBackend();
    await createWindow();
  } catch (error) {
    dialog.showErrorBox(
      'Project INSPIRE – Startup Error',
      `The application failed to start:\n\n${error.message}\n\nPlease try again. If the problem persists, reinstall the application.`
    );
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (backendProcess) {
    backendProcess.kill('SIGTERM');
    backendProcess = null;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    try {
      await createWindow();
    } catch (error) {
      console.error('Failed to re-create window:', error);
    }
  }
});

app.on('will-quit', () => {
  if (backendProcess) {
    backendProcess.kill('SIGTERM');
    backendProcess = null;
  }
});
