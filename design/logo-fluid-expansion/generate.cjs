const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const wr=createRequire(path.resolve(__dirname,'../../web/package.json'));
const sharp=createRequire(wr.resolve('next/package.json'))('sharp');
const p=d=>`<path d="${d}"/>`;
const marks=[
 {id:'X01',name:'跃起',en:'Lift',body:p('M12 66 C23 31 35 17 48 25 C57 30 58 44 66 47 C78 52 84 41 79 33 C75 25 64 24 58 31 C55 34 49 30 52 26 C64 8 87 17 91 34 C96 56 78 69 62 59 C48 51 49 37 43 36 C38 35 31 49 27 61 C24 69 9 77 12 66Z')},
 {id:'X02',name:'相拥',en:'Embrace',body:p('M43 14 C22 10 9 27 13 45 C16 61 29 65 40 61 C49 58 49 50 43 48 C34 47 27 44 28 36 C29 25 42 25 48 29 C53 33 62 22 56 18 C53 16 48 14 43 14Z M57 86 C78 90 91 73 87 55 C84 39 71 35 60 39 C51 42 51 50 57 52 C66 53 73 56 72 64 C71 75 58 75 52 71 C47 67 38 78 44 82 C47 84 52 86 57 86Z')},
 {id:'X03',name:'软结',en:'Soft knot',body:`<path fill-rule="evenodd" d="M14 64 C10 47 15 31 27 28 C40 25 42 42 50 40 C57 38 56 17 72 17 C88 17 94 38 87 52 C81 64 68 61 60 62 C52 62 50 77 39 82 C25 89 17 80 14 64Z M26 60 C26 70 31 76 37 72 C43 68 45 55 38 51 C32 47 25 50 26 60Z M67 36 C64 45 67 51 73 49 C79 46 81 33 76 29 C72 25 69 29 67 36Z"/>`},
 {id:'X04',name:'展开',en:'Unfold',body:p('M10 58 C14 43 31 36 46 41 L67 48 C78 52 84 45 82 37 C80 25 61 24 48 31 L37 37 C46 17 66 10 81 21 C96 32 96 52 82 63 C75 68 66 68 53 63 L31 55 C24 52 18 56 18 62 C18 74 35 78 51 66 C45 85 24 91 14 79 C8 73 8 66 10 58Z')},
 {id:'X05',name:'留隙',en:'A shared space',body:`<path fill-rule="evenodd" d="M14 49 C14 27 27 13 46 14 C65 15 64 36 73 42 C85 50 92 53 89 66 C86 82 72 88 57 80 C48 75 45 68 36 68 C24 68 14 62 14 49Z M32 43 C30 53 36 56 42 52 L52 44 C56 40 52 29 45 28 C37 27 33 34 32 43Z M60 59 C54 64 63 72 70 70 C76 68 77 61 71 57 C68 55 64 56 60 59Z"/>`},
 {id:'X06',name:'回旋',en:'The return',body:p('M15 69 C7 57 12 43 24 40 C41 36 44 54 57 53 C68 52 75 43 74 35 C73 25 62 20 52 26 C47 29 44 35 48 39 C52 42 51 48 47 47 C38 45 33 36 36 26 C40 10 62 7 77 19 C94 32 87 55 69 65 C49 76 37 57 27 55 C21 54 18 58 21 64 C25 71 37 72 44 68 C40 82 24 83 15 69Z')},
];
const svg=(body,color='#252729')=>`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 100 100" fill="${color}">${body}</svg>`;
async function normalize(body){const {data,info}=await sharp(Buffer.from(svg(body))).ensureAlpha().raw().toBuffer({resolveWithObject:true});let l=info.width,r=0,t=info.height,b=0;for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>8){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}const cx=(l+r+1)/2/info.width*100,cy=(t+b+1)/2/info.height*100,extent=Math.max(r-l+1,b-t+1)/info.width*100;return `<g transform="translate(50 50) scale(${76/extent}) translate(${-cx} ${-cy})">${body}</g>`;}
async function main(){
 fs.mkdirSync(path.join(__dirname,'svg'),{recursive:true});
 for(const m of marks){m.body=await normalize(m.body);fs.writeFileSync(path.join(__dirname,'svg',m.id+'.svg'),svg(m.body));fs.writeFileSync(path.join(__dirname,'svg',m.id+'-blue.svg'),svg(m.body,'#007aff'));fs.writeFileSync(path.join(__dirname,'svg',m.id+'-white.svg'),svg(m.body,'white'));}
 const cells=marks.map((m,i)=>{let x=i%3*480,y=130+Math.floor(i/3)*400;return `<g transform="translate(${x} ${y})"><text x="44" y="26" class="id">${m.id}</text><text x="103" y="26" class="label">${m.en}</text><g transform="translate(126 65) scale(2.28)">${m.body}</g><g transform="translate(44 326) scale(.34)">${m.body}</g><text x="90" y="352" class="word">reachard</text><rect x="380" y="313" width="58" height="58" rx="15" fill="#007aff"/><g transform="translate(389 322) scale(.40)" fill="white">${m.body}</g></g>`;}).join('');
 const board=`<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="960" fill="#252729"><style>.id{font:600 17px Arial}.label{font:16px Arial;fill:#7c828a}.word{font:24px Arial}</style><rect width="100%" height="100%" fill="white"/><text x="44" y="54" class="word">reachard / a freer gesture</text><text x="44" y="88" class="label">Six new silhouettes, growing from the same idea of connection.</text>${cells}</svg>`;
 fs.writeFileSync(path.join(__dirname,'exploration.svg'),board);await sharp(Buffer.from(board)).png().toFile(path.join(__dirname,'exploration.png'));
 fs.writeFileSync(path.join(__dirname,'concepts.json'),JSON.stringify(marks,null,2));
 console.log('Six independent outlines rendered and exported in dark, blue and white.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
