const fs=require('node:fs'),path=require('node:path');
const {createRequire}=require('node:module');
const wr=createRequire(path.resolve(__dirname,'../../web/package.json'));
const sharp=createRequire(wr.resolve('next/package.json'))('sharp');
const G=require('./geometry.cjs');
const license=fs.readFileSync(path.join(path.dirname(wr.resolve('lucide-react/package.json')),'LICENSE'),'utf8');
const notice=`<!-- Derived from Lucide Orbit\n${license}-->`;
const variants=G.variants();
const folder=path.join(__dirname,'svg');fs.mkdirSync(folder,{recursive:true});
fs.writeFileSync(path.join(__dirname,'LICENSE.lucide.txt'),license);
for(const p of variants)fs.writeFileSync(path.join(folder,`${p.id}.svg`),`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="-1 -1 26 26">${notice}${G.mark(p)}</svg>`);
fs.writeFileSync(path.join(__dirname,'variants.json'),JSON.stringify(variants,null,2));
const template=fs.readFileSync(path.join(__dirname,'gallery.html'),'utf8');
const geometry=fs.readFileSync(path.join(__dirname,'geometry.cjs'),'utf8');
const fragment=template.replace('<!-- GEOMETRY -->',`<script>${geometry}\nwindow.REACHARD_LICENSE=${JSON.stringify(license)};</script>`);
fs.writeFileSync(path.join(__dirname,'index.html'),`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reachard Logo Lab</title><style>body{margin:0;background:white}</style></head><body>${fragment}</body></html>`);
const picks=['A009','A027','A045','B025','B027','C027','C045','D025','D027','E027','F027','F045'];
async function board(ids,name,columns,cell){
 const rows=Math.ceil(ids.length/columns),width=columns*cell,height=rows*cell+90;
 const items=ids.map((id,i)=>{const p=variants.find(v=>v.id===id),x=i%columns*cell,y=Math.floor(i/columns)*cell+90;const size=cell*.46;return `<g transform="translate(${x+(cell-size)/2} ${y+cell*.12}) scale(${size/26})"><g transform="translate(1 1)">${G.mark(p)}</g></g><text x="${x+cell/2}" y="${y+cell*.78}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${cell<130?12:17}" fill="#62676d">${id}</text>`;}).join('');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${notice}<rect width="100%" height="100%" fill="white"/><text x="32" y="48" font-family="Arial,sans-serif" font-size="24" fill="#252729">reachard / ${name}</text>${items}</svg>`;
 fs.writeFileSync(path.join(__dirname,`${name}.svg`),svg);
 await sharp(Buffer.from(svg)).png().toFile(path.join(__dirname,`${name}.png`));
}
(async()=>{await board(picks,'shortlist',4,260);await board(variants.map(v=>v.id),'all-324',18,110);for(const id of ['A027','B027','C027']){await sharp(path.join(folder,`${id}.svg`)).png().toFile(path.join(__dirname,`${id}.png`));}console.log(`Generated ${variants.length} unique parameterized SVGs, gallery, 12-design shortlist and full contact sheet.`);})().catch(e=>{console.error(e);process.exitCode=1;});
