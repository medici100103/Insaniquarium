// Optional local preview for development only. The game itself needs no server.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const file = url.pathname === '/' ? '/index.html' : url.pathname;
  // Only explicit game assets are served; no directory listing or arbitrary files.
  if (!/^\/(index\.html|js\/(config|entities|game|audio|input|main)\.js|css\/style\.css|Images\/[A-Za-z_]+\.png|Sounds\/[A-Za-z_]+\.mp3)$/.test(file)) {
    res.writeHead(404); res.end('Not found'); return;
  }
  fs.readFile(path.join(root, file), (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(data);
  });
});
server.listen(4173, '127.0.0.1', () => console.log('Aqua Guppy preview: http://127.0.0.1:4173'));
