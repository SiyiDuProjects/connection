import http from 'node:http';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const port = Number(process.env.REACHARD_STORE_PREVIEW_PORT || 3027);
const runtime = new Set(['brand.js', 'content.js', 'content.css', 'ui.js', 'sidepanel.js', 'sidepanel.css', 'sidepanel-context.js', 'sidepanel-boot.js']);
const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

export function createStorePreviewServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    try {
      const brand = JSON.parse(await readFile(new URL('brand/brand.json', root), 'utf8'));
      const name = escape(brand.name || brand.displayName || 'Reachard');
      if (url.pathname === '/') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${name} · Store screenshots</title><style>
          *{box-sizing:border-box}body{margin:0;color:#1d2329;background:#fafafa;font-family:Arial,sans-serif}main{width:calc(100vw - 450px);height:100vh;padding:36px 48px;background:#fff}nav{display:flex;align-items:center;justify-content:space-between;font-size:15px;padding-bottom:28px;border-bottom:1px solid #e9e9e9}.logo{display:flex;align-items:center;gap:10px;font-size:22px;letter-spacing:-.6px;font-weight:600}.logo img{height:32px;width:32px}.sample{display:inline-flex;padding:8px 12px;color:#1650a5;background:#eaf2ff;border:1px solid #d1e3ff;border-radius:100px;font-size:12px;font-weight:600}.breadcrumb{margin:48px 0 24px;color:#787d83;font-size:14px}.eyebrow{font-size:13px;font-weight:600;color:#60666d;margin-bottom:12px}h1{font-size:43px;line-height:1.11;letter-spacing:-1.8px;font-weight:500;margin:0 0 24px;max-width:590px}.location{font-size:14px;color:#696f76;display:flex;gap:16px;margin-bottom:34px}.button{display:inline-block;background:#21262c;border-radius:7px;padding:13px 20px;color:white;font-size:14px}.copy{margin-top:44px;max-width:580px}.copy h2{font-size:21px;font-weight:500;letter-spacing:-.5px;margin:0 0 15px}.copy p,.copy li{font-size:15px;line-height:1.8;color:#696f76}.copy ul{padding-left:20px}.note{position:absolute;bottom:26px;left:48px;max-width:680px;font-size:12px;line-height:1.6;color:#7c8289}.panel{position:fixed;top:0;right:0;width:450px;height:100vh;border-left:1px solid #d9dde2;background:white}.panel-head{height:48px;display:flex;align-items:center;justify-content:space-between;padding:0 18px;border-bottom:1px solid #e6e7e9;font-size:14px}.panel-head span{display:flex;gap:8px;align-items:center}.panel-head img{width:20px;height:20px}.panel-head small{font-size:11px;color:#6d737b}iframe{border:0;width:100%;height:calc(100% - 48px);display:block}
        </style></head><body><main><nav><div class="logo"><img src="/icons/reachard.png" alt="">${name}</div><span class="sample">Sample data · Fictional job & contacts</span></nav><div class="breadcrumb">Northstar Robotics / Careers</div><div class="eyebrow">ENGINEERING</div><h1>Software Engineer,<br>Robotics Data Systems</h1><div class="location"><span>San Francisco, CA</span><span>Full time</span></div><span class="button">View role details</span><section class="copy"><h2>Build systems that bring robots to life.</h2><p>Join the engineering team at Northstar Robotics. Help us build reliable data systems that support robotics research and turn real-world learning into better products.</p><h2>What you will work on</h2><ul><li>Design distributed pipelines for robotics data.</li><li>Collaborate with researchers and product engineers.</li><li>Build tools that help the team learn faster.</li></ul></section><p class="note">Demonstration with fictional content. The side panel uses the current ${name} extension UI.<br>Contact availability varies. You review and send outreach yourself.</p></main><aside class="panel"><div class="panel-head"><span><img src="/icons/reachard.png" alt="">${name}</span><small>Sample data</small></div><iframe title="${name} extension" src="/sidepanel.html${url.search}"></iframe></aside></body></html>`);
      } else if (url.pathname === '/sidepanel.html') {
        const html = await readFile(new URL('extension/sidepanel.html', root), 'utf8');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(html.replace('<script src="ui.js"', '<script src="/store-fixture.js"></script><script src="ui.js"'));
      } else if (url.pathname === '/store-fixture.js') {
        let fixture = await readFile(new URL('extension-ui/sidepanel-fixture.js', root), 'utf8');
        fixture = fixture.replaceAll('OpenAI', 'Northstar Robotics').replaceAll('Software Engineer, Distributed Data Systems — Robotics', 'Software Engineer, Robotics Data Systems');
        fixture = fixture.replaceAll('sample@example.com', 'maya.chen@example.com');
        res.setHeader('Content-Type', 'text/javascript'); res.end(fixture);
      } else if (runtime.has(url.pathname.slice(1))) {
        res.setHeader('Content-Type', url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript');
        res.end(await readFile(new URL(`extension${url.pathname}`, root)));
      } else if (url.pathname === '/icons/reachard.png') {
        res.setHeader('Content-Type', 'image/png'); res.end(await readFile(new URL('extension/icons/reachard.png', root)));
      } else { res.writeHead(404); res.end(); }
    } catch (error) { res.writeHead(500); res.end(`Preview unavailable: ${error.message}`); }
  });
}

if (process.argv[1] && new URL(`file:///${process.argv[1].replaceAll('\\', '/')}`).href === import.meta.url) {
  createStorePreviewServer().listen(port, '127.0.0.1', () => console.log(`Store screenshot fixture: http://127.0.0.1:${port}`));
}
