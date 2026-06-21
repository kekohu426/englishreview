#!/usr/bin/env node

import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const rootDir = dirname(fileURLToPath(import.meta.url));
const frontendDir = join(rootDir, 'frontend');

const children = [
  start('backend', process.execPath, ['backend/server.js'], rootDir),
  start('frontend', process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1'], frontendDir),
];

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log('User app starting...');
console.log('Backend:  http://127.0.0.1:5000/health');
console.log('Frontend: http://127.0.0.1:5173/');

function start(label, command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });

  child.stdout.on('data', chunk => write(label, chunk));
  child.stderr.on('data', chunk => write(label, chunk));
  child.on('exit', (code, signal) => {
    console.log(`[${label}] exited code=${code} signal=${signal || ''}`);
  });

  return child;
}

function write(label, chunk) {
  String(chunk).split(/\r?\n/).filter(Boolean).forEach(line => {
    console.log(`[${label}] ${line}`);
  });
}

function shutdown() {
  children.forEach(child => {
    if (!child.killed) child.kill();
  });
  process.exit(0);
}
