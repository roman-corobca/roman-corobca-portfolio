#!/usr/bin/env node
// Serveur statique local, sans dépendance : node scripts/serve.mjs [dossier] [port]
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';

const root = resolve(process.argv[2] || 'dist');
const port = Number(process.argv[3] || 8080);
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.pdf': 'application/pdf',
  '.zip': 'application/zip', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.txt': 'text/plain; charset=utf-8'
};

createServer((request, response) => {
  let path;
  try { path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); } catch { response.writeHead(400).end(); return; }
  let file = normalize(join(root, path));
  if (file !== root && !file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
  try { if (statSync(file).isDirectory()) file = join(file, 'index.html'); statSync(file); }
  catch { response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Introuvable'); return; }
  response.writeHead(200, { 'content-type': types[extname(file).toLowerCase()] || 'application/octet-stream' });
  createReadStream(file).pipe(response);
}).listen(port, () => console.log(`${root} servi sur http://localhost:${port}/`));
