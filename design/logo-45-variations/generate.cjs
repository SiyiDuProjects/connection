const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const wr = createRequire(path.resolve(__dirname, '../../web/package.json'));
const sharp = createRequire(wr.resolve('next/package.json'))('sharp');
const original = require('../logo-directions/concepts.cjs').find(x => x.id === '45');
const shapes = {
  round: [[41,49],[14,22,12,78,36,78],[60,78,40,22,64,22],[88,22,86,78,59,51]],
  wide: [[40,49],[7,22,9,75,32,75],[59,75,41,25,68,25],[91,25,93,78,60,51]],
  tall: [[40,48],[18,24,15,82,36,82],[58,82,42,18,64,18],[85,18,82,76,60,52]],
  open: [[37,47],[14,26,13,77,35,77],[60,77,40,23,65,23],[87,23,86,74,63,53]],
  close: [[42,46],[13,18,12,79,36,79],[61,79,39,21,64,21],[88,21,87,82,58,54]],
  unequal: [[38,50],[13,27,14,76,34,76],[58,76,38,18,63,18],[91,18,88,80,60,52]],
  ribbon: [[37,48],[12,22,12,79,35,79],[60,79,40,21,65,21],[88,21,88,78,63,52]],
};
const d = s => `M${s[0].join(' ')} ` + s.slice(1).map(c => 'C'+c.join(' ')).join(' ');
const line = (s,w) => `<path d="${d(s)}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
// A filled variable-width ribbon, sampled from the same three connected cubic curves.
// Rounded ends and transparent counters make it usable on any background.
function ribbon(s, widthAt) {
  const samples=[];
  let start=s[0];
  s.slice(1).forEach((v,k)=>{
    for(let j=0;j<=100;j++) {
      if(k && !j)continue;
      const t=j/100,u=1-t;
      const x=u*u*u*start[0]+3*u*u*t*v[0]+3*u*t*t*v[2]+t*t*t*v[4];
      const y=u*u*u*start[1]+3*u*u*t*v[1]+3*u*t*t*v[3]+t*t*t*v[5];
      const dx=3*u*u*(v[0]-start[0])+6*u*t*(v[2]-v[0])+3*t*t*(v[4]-v[2]);
      const dy=3*u*u*(v[1]-start[1])+6*u*t*(v[3]-v[1])+3*t*t*(v[5]-v[3]);
      const len=Math.hypot(dx,dy),r=widthAt((k+t)/3)/2;
      samples.push({x,y,nx:-dy/len,ny:dx/len,r});
    }
    start=v.slice(4);
  });
  const pts=samples.map(p=>[p.x+p.nx*p.r,p.y+p.ny*p.r]);
  const end=samples.at(-1),first=samples[0];
  for(let j=1;j<=20;j++){const a=Math.atan2(end.ny,end.nx)-Math.PI*j/20;pts.push([end.x+Math.cos(a)*end.r,end.y+Math.sin(a)*end.r]);}
  pts.push(...samples.slice().reverse().map(p=>[p.x-p.nx*p.r,p.y-p.ny*p.r]));
  for(let j=1;j<=20;j++){const a=Math.atan2(-first.ny,-first.nx)-Math.PI*j/20;pts.push([first.x+Math.cos(a)*first.r,first.y+Math.sin(a)*first.r]);}
  return `<path d="M${pts.map(p=>p.map(n=>n.toFixed(3)).join(' ')).join(' L')}Z"/>`;
}
const designs=[
  {id:'45A',name:'圆润',en:'Soft loops',body:line(shapes.round,8)},
  {id:'45B',name:'舒展',en:'Wide and relaxed',body:line(shapes.wide,8)},
  {id:'45C',name:'挺拔',en:'Upright',body:line(shapes.tall,8.4)},
  {id:'45D',name:'开放',en:'Open ends',body:line(shapes.open,7.8)},
  {id:'45E',name:'紧凑',en:'Close connection',body:line(shapes.close,9.2)},
  {id:'45F',name:'错落',en:'Asymmetric',body:line(shapes.unequal,8.6)},
  {id:'45G',name:'柔带',en:'Soft ribbon',body:ribbon(shapes.ribbon,t=>6+5*Math.pow(Math.sin(Math.PI*t),.7))},
  {id:'45H',name:'块面',en:'Sculpted',body:ribbon(shapes.ribbon,t=>8+5*Math.pow(Math.sin(Math.PI*t),2))},
  {id:'45I',name:'笔触',en:'Organic gesture',body:ribbon(shapes.open,t=>6.5+6*(.5+.5*Math.cos(6*Math.PI*t+1.1)))},
];
const wrap=(body,color='#252729')=>`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 100 100" style="color:${color}" fill="currentColor">${body}</svg>`;
async function normalized(body){
  const {data,info}=await sharp(Buffer.from(wrap(body))).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let l=info.width,r=0,t=info.height,b=0;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>8){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}
  const cx=(l+r+1)/2/info.width*100,cy=(t+b+1)/2/info.height*100,extent=Math.max(r-l+1,b-t+1)/info.width*100;
  return `<g transform="translate(50 50) scale(${(76/extent).toFixed(6)}) translate(${-cx} ${-cy})">${body}</g>`;
}
async function board(items,filename){
  const height=150+Math.ceil(items.length/3)*370;
  const cells=items.map((m,i)=>{const x=i%3*480,y=150+Math.floor(i/3)*370;return `<g transform="translate(${x} ${y})"><text x="44" y="28" class="id">${m.id}</text><text x="109" y="28" class="name">${m.en}</text><g transform="translate(125 51) scale(2.3)">${m.body}</g><g transform="translate(44 296) scale(.34)">${m.body}</g><text x="90" y="322" class="word">reachard</text><rect x="384" y="284" width="54" height="54" rx="14" fill="#007aff"/><g transform="translate(392 292) scale(.38)" fill="white" style="color:white">${m.body}</g></g>`;}).join('');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="${height}" fill="#252729" style="color:#252729"><style>.id{font:600 17px Arial}.name{font:16px Arial;fill:#82878e}.word{font:23px Arial}</style><rect width="100%" height="100%" fill="white"/><text x="44" y="55" class="word">reachard / variations on 45</text><text x="44" y="92" class="name">One connected gesture. Nine expressions.</text><g transform="translate(1250 24) scale(.7)">${original.body}</g><text x="1340" y="65" class="name">45</text>${cells}</svg>`;
  fs.writeFileSync(path.join(__dirname,filename+'.svg'),svg);
  await sharp(Buffer.from(svg)).png().toFile(path.join(__dirname,filename+'.png'));
}
async function main(){
  fs.mkdirSync(path.join(__dirname,'svg'),{recursive:true});
  for(const m of designs){m.body=await normalized(m.body);for(const [suffix,color] of [['','#252729'],['-blue','#007aff'],['-white','#ffffff']])fs.writeFileSync(path.join(__dirname,'svg',m.id+suffix+'.svg'),wrap(m.body,color));}
  await board(designs,'all-nine');
  await board(designs.slice(0,6),'line-variations');
  await board(designs.slice(6),'ribbon-variations');
  const cards=designs.map(m=>`<article><div class="mark">${wrap(m.body)}</div><h2>${m.id} · ${m.name}</h2><div class="lockup"><span>${wrap(m.body)}</span>reachard</div><a href="svg/${m.id}.svg" download>下载 SVG</a></article>`).join('');
  fs.writeFileSync(path.join(__dirname,'index.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reachard · 45 号的九个版本</title><style>*{box-sizing:border-box}body{margin:0;font:16px system-ui,sans-serif;color:#252729;background:#f8f8f9}main{max-width:1200px;margin:0 auto;padding:40px 24px}h1{font-size:30px}p{color:#72777e}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:36px}article{background:white;border:1px solid #e7e7e9;border-radius:20px;padding:24px}.mark{display:grid;place-items:center;height:240px}.mark svg{width:200px;height:200px}h2{font-size:18px;font-weight:550}.lockup{display:flex;align-items:center;gap:10px;font-size:24px;margin:22px 0}.lockup svg{width:32px;height:32px;display:block}a{color:#007aff;font-size:14px}header{display:flex;justify-content:space-between;align-items:center}.original{text-align:center;color:#777;font-size:13px}.original svg{width:75px;height:75px;display:block}@media(max-width:800px){.grid{grid-template-columns:repeat(2,1fr)}.mark{height:180px}.mark svg{width:160px;height:160px}}@media(max-width:480px){main{padding:24px 16px}.grid{gap:12px}article{padding:16px}.mark{height:135px}.mark svg{width:125px;height:125px}.lockup{font-size:20px}h1{font-size:24px}}</style><main><header><div><h1>45 号，再往前一步</h1><p>保留双涡相连，比较轮廓、开口和块面。</p></div><div class="original">${wrap(original.body)}原版 45</div></header><div class="grid">${cards}</div></main></html>`);
  console.log(`Created ${designs.length} variants, 27 transparent SVG exports, 3 comparison sheets, and a local gallery.`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
