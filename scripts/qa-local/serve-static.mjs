// Serves a static build (SPA fallback to index.html) for local QA. Usage: node scripts/qa-local/serve-static.mjs <dir> [port=4175]
import http from 'node:http'; import { readFile } from 'node:fs/promises'; import { extname, join, normalize } from 'node:path';
const root = process.argv[2]; const port = Number(process.argv[3] || 4175);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };
http.createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  try { const body = await readFile(join(root, path)); res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' }); res.end(body); }
  catch { const body = await readFile(join(root, 'index.html')); res.writeHead(200, { 'content-type': 'text/html' }); res.end(body); }
}).listen(port, '127.0.0.1', () => console.log(`serving ${root} on ${port}`));
