import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const backendDir = path.join(repoRoot, 'backend');
const frontendDir = path.join(repoRoot, 'frontend');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const processes = [];

function startProcess(label, command, args, cwd, extraEnv = {}) {
  const child = spawn(command, args, {
    cwd,
    shell: false,
    env: {
      ...process.env,
      ...extraEnv
    }
  });

  child.stdout.on('data', (chunk) => {
    process.stdout.write(`[${label}] ${chunk}`);
  });

  child.stderr.on('data', (chunk) => {
    process.stderr.write(`[${label}] ${chunk}`);
  });

  child.on('error', (error) => {
    process.stderr.write(`[${label}] failed to start: ${error.message}\n`);
    stopAll();
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.stdout.write(`[${label}] exited with signal ${signal}\n`);
    } else {
      process.stdout.write(`[${label}] exited with code ${code}\n`);
    }
  });

  processes.push(child);
  return child;
}

function stopAll() {
  for (const child of processes) {
    if (!child.killed) {
      child.kill();
    }
  }
}

process.on('SIGINT', () => {
  stopAll();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopAll();
  process.exit(0);
});

console.log('Starting Project INSPIRE backend on http://localhost:3000');
console.log('Starting Project INSPIRE Angular app on http://localhost:4200');

startProcess('backend', npmCommand, ['run', 'start'], backendDir);
startProcess('frontend', npmCommand, ['run', 'start'], frontendDir);