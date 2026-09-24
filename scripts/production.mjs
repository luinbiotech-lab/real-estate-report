import { spawn } from 'node:child_process';

const children = [];
let shuttingDown = false;

function start(label, file) {
  const child = spawn(process.execPath, [file], {
    stdio: 'inherit',
    env: process.env,
  });
  children.push(child);
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    const reason = signal ? `signal ${signal}` : `code ${code ?? 0}`;
    console.error(`[production] ${label} exited (${reason}). Stopping runtime.`);
    shutdown(code ?? 1);
  });
  return child;
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  const timer = setTimeout(() => {
    for (const child of children) if (!child.killed) child.kill('SIGKILL');
    process.exit(code);
  }, 3000);
  timer.unref();
  Promise.all(children.map((child) => new Promise((resolve) => child.once('exit', resolve)))).finally(() => process.exit(code));
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

start('map-proxy', 'server/proxy.mjs');
start('frontend', 'server/frontend.mjs');
