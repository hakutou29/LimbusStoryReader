import http from 'node:http';
import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(repoRoot, '..');
const port = Number(process.env.PORT || 4173);

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function resolveRequestPath(urlPath) {
  const normalizedPath = path
    .normalize(decodeURIComponent(urlPath))
    .replace(/^([/\\])+/, '')
    .replace(/^([.][.][/\\])+/, '');
  return path.join(workspaceRoot, normalizedPath);
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);

  if (requestUrl.pathname === '/' || requestUrl.pathname === '') {
    response.writeHead(302, { Location: '/story-viewer/' });
    response.end();
    return;
  }

  const filePath = resolveRequestPath(requestUrl.pathname);

  try {
    const stat = await fs.stat(filePath);
    const finalPath = stat.isDirectory() ? path.join(filePath, 'index.html') : filePath;
    const extension = path.extname(finalPath).toLowerCase();
    response.writeHead(200, {
      'Content-Type': mimeTypes[extension] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    createReadStream(finalPath).pipe(response);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
});

server.listen(port, () => {
  console.log(`Story viewer available at http://localhost:${port}/story-viewer/`);
});