import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const useShell = process.platform === 'win32';

let frontendProcess = null;
let electronProcess = null;
let shuttingDown = false;

function log(scope, message) {
  process.stdout.write(`[${scope}] ${message}\n`);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (isAvailable) => {
      if (settled) {
        return;
      }

      settled = true;
      socket.destroy();
      resolve(isAvailable);
    };

    socket.setTimeout(800);

    socket.once('connect', () => finish(false));
    socket.once('timeout', () => finish(true));
    socket.once('error', (error) => {
      const errorCode = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
      if (errorCode === 'ECONNREFUSED') {
        finish(true);
        return;
      }

      finish(false);
    });

    socket.connect(port, 'localhost');
  });
}

async function findFreePort(startPort = 4200, attempts = 20) {
  for (let offset = 0; offset < attempts; offset += 1) {
    const port = startPort + offset;
    // Pick the first local port that can be bound.
    if (await isPortAvailable(port)) {
      return port;
    }
  }

  throw new Error(`No free port found in range ${startPort}-${startPort + attempts - 1}`);
}

function requestServer(port) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:${port}/`, (response) => {
      response.resume();
      resolve(response.statusCode || 0);
    });

    req.on('error', reject);
    req.setTimeout(2500, () => {
      req.destroy(new Error('timeout'));
    });
  });
}

async function waitForFrontend(port, timeoutMs = 120000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const statusCode = await requestServer(port);
      if (statusCode >= 200 && statusCode < 500) {
        return;
      }
    } catch {
      // Keep retrying until timeout.
    }

    await wait(1000);
  }

  throw new Error(`Frontend was not reachable at http://localhost:${port} within ${timeoutMs / 1000}s.`);
}

function stopProcess(child, signal = 'SIGTERM') {
  if (!child || child.killed) {
    return;
  }

  try {
    child.kill(signal);
  } catch {
    // Ignore kill errors during shutdown.
  }
}

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  stopProcess(electronProcess);
  stopProcess(frontendProcess);

  setTimeout(() => {
    process.exit(exitCode);
  }, 300);
}

function pipeOutput(child, scope) {
  child.stdout.on('data', (chunk) => {
    process.stdout.write(`[${scope}] ${chunk}`);
  });

  child.stderr.on('data', (chunk) => {
    process.stderr.write(`[${scope}] ${chunk}`);
  });
}

async function main() {
  const port = await findFreePort();
  const frontendUrl = `http://localhost:${port}`;

  log('launcher', `Starting Angular dev server on ${frontendUrl}`);
  frontendProcess = spawn(
    npmCommand,
    ['--prefix', 'frontend', 'run', 'start', '--', '--port', String(port)],
    {
      cwd: repoRoot,
      shell: useShell,
      env: process.env
    }
  );

  pipeOutput(frontendProcess, 'frontend');

  frontendProcess.on('exit', (code) => {
    if (!shuttingDown) {
      log('frontend', `Exited early with code ${code ?? 'unknown'}`);
      shutdown(code || 1);
    }
  });

  await waitForFrontend(port);
  log('launcher', `Frontend is ready at ${frontendUrl}`);

  log('launcher', 'Starting Electron');
  electronProcess = spawn(npxCommand, ['--no-install', 'electron', '.'], {
    cwd: repoRoot,
    shell: useShell,
    env: {
      ...process.env,
      INSPIRE_DEV_SERVER_URL: frontendUrl
    }
  });

  pipeOutput(electronProcess, 'electron');

  electronProcess.on('exit', (code) => {
    if (!shuttingDown) {
      log('electron', `Exited with code ${code ?? 'unknown'}`);
      shutdown(code || 0);
    }
  });
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

main().catch((error) => {
  process.stderr.write(`[launcher] ${error.message}\n`);
  shutdown(1);
});
