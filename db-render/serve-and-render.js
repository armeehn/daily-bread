/**
 * serve-and-render.js — keep an in-process static server + the render child in a
 * single process tree (the sandbox reaps detached background servers between
 * Bash calls). Serves the kit folder, then spawns the pristine render_dc_print.js.
 *
 * argv: <kit-dir> <issue-file-name> <out-pdf> [expectedSheets]
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const KIT = process.argv[2];
const ISSUE = process.argv[3];
const OUT = process.argv[4];
const SHEETS = process.argv[5] || '';
const PORT = 8471;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript',
  '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.json': 'application/json',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.md': 'text/markdown',
};

const server = http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/') rel = '/index.html';
  const file = path.join(KIT, rel);
  if (!file.startsWith(KIT)) { res.writeHead(403); return res.end('no'); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(buf);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${PORT}/${encodeURIComponent(ISSUE)}`;
  console.log('serving', KIT, '->', url);
  const child = spawn('node', ['render_dc_print.js'], {
    cwd: KIT,
    env: { ...process.env, URL: url, OUT, VENDOR: path.join(KIT, 'vendor'), SHEETS },
    stdio: 'inherit',
  });
  child.on('exit', (code) => { server.close(); process.exit(code || 0); });
});
server.on('error', (e) => { console.error('BIND ERR', e.code); process.exit(1); });
