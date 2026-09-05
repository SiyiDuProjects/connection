import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Local-only test harness: serves the exact packaged content scripts.
// The Chrome API fixture below never ships in extension/ or the install ZIP.
const root = new URL('../', import.meta.url);
const assets = new Map(['content.js','content.css','ui.js','sidepanel.js','sidepanel.css','sidepanel-context.js'].map(name => [`/${name}`, new URL(`extension/${name}`, root)]));
assets.set('/sidepanel-fixture.js', new URL('extension-ui/sidepanel-fixture.js', root));
http.createServer(async (req,res) => {
  const pathname = new URL(req.url, 'http://127.0.0.2:3020').pathname;
  try {
    if (pathname === '/jobs/robotics') {
      const fixture = await readFile(new URL('extension-ui/fixture.html', root), 'utf8');
      res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
      res.end(fixture.replace('70px 470px 80px 7vw', '70px 7vw 80px').replace('max-width:650px', 'max-width:850px'));
      return;
    }
    if (pathname === '/' || pathname === '/sidepanel.html') {
      const html = await readFile(new URL('extension/sidepanel.html', root), 'utf8');
      res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
      res.end(html.replace('<script src="ui.js"', '<script src="/sidepanel-fixture.js"></script><script src="ui.js"'));
      return;
    }
    if (!assets.has(pathname)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, {'Content-Type': pathname.endsWith('.css') ? 'text/css' : 'text/javascript'});
    res.end(await readFile(assets.get(pathname)));
  } catch (error) { res.writeHead(500); res.end('Local preview unavailable'); }
}).listen(3020, '127.0.0.2', () => console.log('Custom dock fixture: http://127.0.0.2:3020/jobs/robotics (simulated Chrome APIs)'));
