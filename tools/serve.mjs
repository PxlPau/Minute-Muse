/* =============================================================================
   tools/serve.mjs — zero-dependency static server for local development
   `npm run serve` → http://localhost:8000
   Serves the project root with correct MIME types for .js modules and .webmanifest.
   ========================================================================== */

import http from 'node:http';
import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT) || 8000;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.txt': 'text/plain; charset=utf-8',
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const filePath = path.join(root, pathname);
    if (!filePath.startsWith(root)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    const stat = await fs.stat(filePath).catch(() => null);
    if (!stat || stat.isDirectory()) {
      const notFound = await fs.readFile(path.join(root, '404.html')).catch(() => 'Not found');
      res.writeHead(404, { 'Content-Type': TYPES['.html'] }).end(notFound);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Service-Worker-Allowed': '/',
    });
    createReadStream(filePath).pipe(res);
  } catch (error) {
    res.writeHead(500).end(`Server error: ${error.message}`);
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Minute Muse → http://localhost:${port}`);
});
