// Canonical expanded export: node design/logo-directions/generate-share.cjs
// Uses the existing standalone gallery shell and regenerates its entire concept dataset.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{createRequire}=require('node:module');
const wr=createRequire(path.resolve(__dirname,'../../web/package.json'));
const sharp=createRequire(wr.resolve('next/package.json'))('sharp');
const source=require('./concepts.cjs');
const makeSvg=(x,box='0 0 100 100')=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" width="1024" height="1024" style="color:#252729" fill="currentColor">${x.body}</svg>`;
async function normalize(x){
 const {data,info}=await sharp(Buffer.from(makeSvg(x,'-12 -12 124 124'))).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let left=info.width,top=info.height,right=-1,bottom=-1;
 for(let y=0;y<info.height;y++)for(let xx=0;xx<info.width;xx++)if(data[(y*info.width+xx)*4+3]>8){left=Math.min(left,xx);right=Math.max(right,xx);top=Math.min(top,y);bottom=Math.max(bottom,y);}
 if(right<left)throw new Error(`Empty mark ${x.id}`);
 const cx=((left+right+1)/2/info.width)*124-12,cy=((top+bottom+1)/2/info.height)*124-12;
 const extent=Math.max(right-left+1,bottom-top+1)/info.width*124,scale=76/extent;
 return {...x,body:`<g transform="translate(50 50) scale(${scale.toFixed(6)}) translate(${-cx.toFixed(6)} ${-cy.toFixed(6)})">${x.body}</g>`,normalization:{maxVisibleExtent:76,sourceBounds:{left,top,right,bottom},scale}};
}
async function board(items,name){
 const columns=8,cell=200,header=110,width=1600,height=Math.ceil(items.length/columns)*cell+header;
 const pieces=[];
 for(let i=0;i<items.length;i++)pieces.push({input:await sharp(Buffer.from(makeSvg(items[i]))).resize(132,132).png().toBuffer(),left:i%columns*cell+34,top:header+Math.floor(i/columns)*cell+16});
 const labels=items.map((x,i)=>`<text x="${i%columns*cell+100}" y="${header+Math.floor(i/columns)*cell+176}" text-anchor="middle" font-family="Arial,sans-serif" font-size="21" font-weight="500" fill="#555b63">${x.id}</text>`).join('');
 const range=`${items[0].id} - ${items.at(-1).id}`;
 const base=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="white"/><text x="42" y="48" font-family="Arial,sans-serif" font-size="28" fill="#252729">reachard / logo selection</text><text x="42" y="82" font-family="Arial,sans-serif" font-size="17" fill="#737b85">Choose your favorites by number. All symbols shown at a consistent scale.</text><text x="1558" y="48" text-anchor="end" font-family="Arial,sans-serif" font-size="23" fill="#555b63">${range}</text>${labels}</svg>`;
 await sharp(Buffer.from(base)).composite(pieces).png().toFile(path.join(__dirname,name));
}
async function main(){
 const all=[];for(const item of source)all.push(await normalize(item));
 const svgDir=path.join(__dirname,'svg');fs.mkdirSync(svgDir,{recursive:true});
 for(const x of all)fs.writeFileSync(path.join(svgDir,x.id+'.svg'),makeSvg(x));
 fs.writeFileSync(path.join(__dirname,'concepts.json'),JSON.stringify(all,null,2));
 let html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
 const start=html.indexOf('const all='),end=html.indexOf(',q=s=>',start);
 if(start<0||end<0)throw new Error('Gallery data markers missing');
 html=html.slice(0,start)+'const all='+JSON.stringify(all).replaceAll('</','<\/')+html.slice(end);
 html=html.replace(/Reachard · \d+ 个不同方向/,'Reachard · 96 个不同方向').replace(/<h1>\d+ 个不同构思。<\/h1>/,'<h1>96 个不同构思。</h1>').replace(/全部 \d+ 个/,'全部 96 个');
 html=html.replace(/<label>尺寸 <select id="size">[\s\S]*?<\/select><\/label>/,'<small>统一尺寸 · 原比例居中</small>');
 html=html.replace("q('#size').onchange=()=>document.body.style.setProperty('--size',q('#size').value+'px');",'');
 html=html.replace("q('#sizes').innerHTML=[16,24,32,48].map(s=>'<div><div class=\"sample\">'+img(active,s)+'</div><small>'+s+'px</small></div>').join('');","q('#sizes').hidden=true;");
 html=html.replace('.preview img{width:var(--size,80px);height:var(--size,80px)}','.preview img{width:96px;height:96px}');
 if(!html.includes('id="share-links"'))html=html.replace('</nav>','</nav><p id="share-links" style="display:flex;gap:18px;flex-wrap:wrap;font-size:13px"><a href="share-all-96.png" download>下载完整图板 01–96</a><a href="share-01-48.png" download>下载图板 01–48</a><a href="share-49-96.png" download>下载图板 49–96</a></p>');
 fs.writeFileSync(path.join(__dirname,'index.html'),html);
 await board(all,'share-all-96.png');await board(all.slice(0,48),'share-01-48.png');await board(all.slice(48),'share-49-96.png');
 fs.copyFileSync(path.join(__dirname,'share-all-96.png'),path.join(__dirname,'all-directions.png'));
 const script=html.slice(html.indexOf('<script>')+8,html.lastIndexOf('</script>'));new (require('node:vm').Script)(script);
 const hashes=new Set(all.map(x=>crypto.createHash('sha256').update(x.body).digest('hex')));
 if(all.length!==96||hashes.size!==96)throw new Error('Expected 96 distinct source geometries');
 console.log(JSON.stringify({count:all.length,distinctGeometryHashes:hashes.size,sameMaxVisibleExtent:76,shareBoards:['share-all-96.png','share-01-48.png','share-49-96.png']}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
