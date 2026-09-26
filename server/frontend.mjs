import http from 'node:http';
import { access, readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { serverEnv } from './env.mjs';

const HOST = serverEnv.frontendHost;
const PORT = serverEnv.frontendPort;
const DIST_ROOT = resolve(process.cwd(), 'dist');
const INDEX_FILE = resolve(DIST_ROOT, 'index.html');
const INTERNAL_PROXY = new URL(serverEnv.mapProxyInternalUrl);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

function securityHeaders() {
  return {
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'camera=(), microphone=()',
  };
}

function json(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...securityHeaders() });
  response.end(JSON.stringify(body));
}

function safeDistPath(pathname) {
  const decoded = decodeURIComponent(pathname);
  const relative = decoded.replace(/^\/+/, '');
  const candidate = resolve(DIST_ROOT, relative);
  if (candidate !== DIST_ROOT && !candidate.startsWith(DIST_ROOT + sep)) throw new Error('INVALID_PATH');
  return candidate;
}

async function sendFile(response, filePath, method) {
  const body = await readFile(filePath);
  const extension = extname(filePath).toLowerCase();
  const immutable = filePath.includes(`${sep}assets${sep}`);
  response.writeHead(200, {
    'content-type': MIME_TYPES[extension] || 'application/octet-stream',
    'content-length': String(body.byteLength),
    'cache-control': extension === '.html' ? 'no-cache' : immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
    ...securityHeaders(),
  });
  if (method === 'HEAD') response.end();
  else response.end(body);
}

async function proxyApi(request, response, url) {
  if (!['GET', 'OPTIONS'].includes(request.method || 'GET')) return json(response, 405, { code: 'METHOD_NOT_ALLOWED', message: 'GET/OPTIONS 요청만 지원합니다.' });
  const target = new URL(url.pathname + url.search, INTERNAL_PROXY);
  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers: request.method === 'OPTIONS' ? { origin: request.headers.origin || '' } : undefined,
      cache: 'no-store',
    });
    const buffer = Buffer.from(await upstream.arrayBuffer());
    const headers = {
      'content-type': upstream.headers.get('content-type') || 'application/octet-stream',
      'cache-control': 'no-store',
      ...securityHeaders(),
    };
    response.writeHead(upstream.status, headers);
    response.end(buffer);
  } catch {
    json(response, 502, { code: 'PROXY_UNAVAILABLE', message: 'Protected map/POI proxy에 연결할 수 없습니다.' });
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || `${HOST}:${PORT}`}`);

    if (url.pathname === '/healthz') {
      return json(response, 200, { status: 'ok', frontend: true, proxyConfigured: Boolean(serverEnv.mapProxyInternalUrl) });
    }

    if (url.pathname.startsWith('/api/')) return await proxyApi(request, response, url);
    if (!['GET', 'HEAD'].includes(request.method || 'GET')) return json(response, 405, { code: 'METHOD_NOT_ALLOWED', message: 'GET/HEAD 요청만 지원합니다.' });

    const requested = url.pathname === '/' ? INDEX_FILE : safeDistPath(url.pathname);
    try {
      await access(requested);
      return await sendFile(response, requested, request.method || 'GET');
    } catch {
      await access(INDEX_FILE);
      return await sendFile(response, INDEX_FILE, request.method || 'GET');
    }
  } catch (error) {
    if (error instanceof URIError || (error instanceof Error && error.message === 'INVALID_PATH')) {
      return json(response, 400, { code: 'INVALID_PATH', message: '유효하지 않은 요청 경로입니다.' });
    }
    json(response, 500, { code: 'FRONTEND_SERVER_ERROR', message: 'Production frontend 처리 중 오류가 발생했습니다.' });
  }
});

await access(INDEX_FILE).catch(() => {
  throw new Error('dist/index.html이 없습니다. 먼저 npm run build를 실행하세요.');
});

server.listen(PORT, HOST, () => {
  console.log(`[frontend] http://${HOST}:${PORT} (dist=${DIST_ROOT}, proxy=${INTERNAL_PROXY.origin})`);
});
