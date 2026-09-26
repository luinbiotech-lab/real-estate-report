import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const env = {
  ...process.env,
  FRONTEND_HOST: '127.0.0.1',
  FRONTEND_PORT: '4174',
  MAP_PROXY_HOST: '127.0.0.1',
  MAP_PROXY_PORT: '5175',
  MAP_PROXY_INTERNAL_URL: 'http://127.0.0.1:5175',
};

let output = '';
const runtime = spawn(process.execPath, ['scripts/production.mjs'], {
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
});
runtime.stdout.on('data', (chunk) => { output += chunk.toString(); });
runtime.stderr.on('data', (chunk) => { output += chunk.toString(); });

async function waitFor(url, check, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (response.ok && await check(response)) return;
      lastError = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }
  throw lastError instanceof Error ? lastError : new Error(`Timed out waiting for ${url}`);
}

async function stopRuntime() {
  if (runtime.exitCode != null) return;
  runtime.kill('SIGTERM');
  const exited = new Promise((resolve) => runtime.once('exit', resolve));
  await Promise.race([exited, delay(4_000)]);
  if (runtime.exitCode == null) runtime.kill('SIGKILL');
}

try {
  await waitFor('http://127.0.0.1:4174/healthz', async (response) => {
    const body = await response.json();
    return body.status === 'ok' && body.frontend === true && body.proxyConfigured === true;
  });

  await waitFor('http://127.0.0.1:4174/api/status', async (response) => {
    const body = await response.json();
    return typeof body.naverConfigured === 'boolean' &&
      typeof body.kakaoConfigured === 'boolean' &&
      typeof body.allowedOriginCount === 'number';
  });

  await waitFor('http://127.0.0.1:4174/property/daon-bangbae-815-11', async (response) => {
    const type = response.headers.get('content-type') || '';
    const body = await response.text();
    return type.includes('text/html') && body.includes('id="root"');
  });

  const head = await fetch('http://127.0.0.1:4174/', { method: 'HEAD' });
  if (!head.ok || !(head.headers.get('content-type') || '').includes('text/html')) {
    throw new Error('Production frontend HEAD response is invalid.');
  }

  console.log('Self-hosted production runtime smoke: PASS');
} catch (error) {
  console.error(output);
  throw error;
} finally {
  await stopRuntime();
}
