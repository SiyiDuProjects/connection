const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=__dirname;
http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  const name=url.pathname==='/'?'index.html':url.pathname.slice(1);
  if(!/^(index\.html|all-directions\.png|shortlist\.png|share-(all-96|01-48|49-96)\.png|svg\/\d{2}\.svg)$/.test(name)){res.writeHead(404);return res.end();}
  const target=path.join(root,name);
  if(!fs.existsSync(target)){res.writeHead(404);return res.end();}
  res.setHeader('Content-Type',name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.svg')?'image/svg+xml':'image/png');
  res.setHeader('Cache-Control','no-store');fs.createReadStream(target).pipe(res);
}).listen(8885,'127.0.0.1',()=>console.log('Logo directions preview: http://127.0.0.1:8885'));
