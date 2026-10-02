// Six individually drawn mark studies. Run from this directory with node generate.cjs.
const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const wr=createRequire(path.resolve(__dirname,'../../web/package.json'));
const sharp=createRequire(wr.resolve('next/package.json'))('sharp');
const marks=[
 {id:'S01',name:'Exchange',body:`<path d="M49 14 C29 10 13 23 13 42 C13 57 25 65 39 64 L48 51 L36 51 C28 51 25 47 25 41 C25 30 35 24 49 28Z M51 86 C71 90 87 77 87 58 C87 43 75 35 61 36 L52 49 L64 49 C72 49 75 53 75 59 C75 70 65 76 51 72Z"/>`},
 {id:'S02',name:'Between',body:`<path d="M45 12 C22 12 10 27 10 49 C10 68 22 81 43 86 C32 74 32 61 44 51 C59 39 61 27 45 12Z M55 88 C78 88 90 73 90 51 C90 32 78 19 57 14 C68 26 68 39 56 49 C41 61 39 73 55 88Z"/>`},
 {id:'S03',name:'Resonance',body:`<path d="M77 20 C49 -3 12 17 12 50 C12 84 48 101 76 82 L67 70 C48 83 26 71 26 50 C26 29 49 17 67 31Z M59 36 C48 27 33 35 33 50 C33 66 49 73 61 63 L53 54 C49 58 44 55 44 50 C44 45 49 42 53 46Z"/>`},
 {id:'S04',name:'Common Ground',body:`<path d="M16 28 Q16 16 28 16 H57 Q72 16 72 31 V39 H59 V33 Q59 29 55 29 H33 Q29 29 29 33 V55 Q29 59 33 59 H39 V72 H31 Q16 72 16 57Z M84 72 Q84 84 72 84 H43 Q28 84 28 69 V61 H41 V67 Q41 71 45 71 H67 Q71 71 71 67 V45 Q71 41 67 41 H61 V28 H69 Q84 28 84 43Z"/><path d="M46 40 L60 54 L54 60 L40 46Z"/>`},
 {id:'S05',name:'Open Loop',body:`<path d="M64 12 C40 4 14 21 12 46 C10 71 31 91 55 88 C71 86 82 75 87 60 L74 55 C70 69 62 76 51 75 C36 75 25 64 25 50 C25 34 37 23 52 23 L46 35 L70 30Z"/>`},
 {id:'S06',name:'In Conversation',body:`<path fill-rule="evenodd" d="M24 15 H58 C77 15 88 28 88 45 C88 62 76 75 58 75 H48 L27 89 L31 73 C16 69 10 59 10 45 C10 28 15 15 24 15Z M35 29 C27 29 23 34 23 42 C23 50 27 55 35 55 H39 V44 H33 Q31 44 31 42 Q31 38 35 38 H41 V29Z M55 34 V45 H61 Q63 45 63 48 Q63 52 59 52 H53 V61 H59 C67 61 72 56 72 48 C72 40 67 34 59 34Z"/>`}
];
const wrap=(body,color='#252729')=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="1024" height="1024" style="color:${color}" fill="currentColor">${body}</svg>`;
async function main(){
 for(const m of marks){fs.writeFileSync(path.join(__dirname,m.id+'.svg'),wrap(m.body));await sharp(Buffer.from(wrap(m.body))).png().toFile(path.join(__dirname,m.id+'.png'));}
 const width=1440,height=1040,cellW=480,cellH=470,top=100;
 const text=marks.map((m,i)=>{const x=i%3*cellW,y=top+Math.floor(i/3)*cellH;return `<text x="${x+50}" y="${y+30}" font-family="Arial,sans-serif" font-size="16" fill="#858991">${m.id}</text><text x="${x+50}" y="${y+400}" font-family="Arial,sans-serif" font-size="22" fill="#252729">reachard</text>`;}).join('');
 const base=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="white"/><text x="50" y="55" font-family="Arial,sans-serif" font-size="22" fill="#252729">reachard / new mark studies</text>${text}</svg>`;
 const composites=[];
 for(let i=0;i<marks.length;i++){const x=i%3*cellW,y=top+Math.floor(i/3)*cellH;composites.push({input:await sharp(Buffer.from(wrap(marks[i].body))).resize(210,210).png().toBuffer(),left:x+135,top:y+92});const tile=`<svg xmlns="http://www.w3.org/2000/svg" width="70" height="70" viewBox="0 0 100 100"><rect width="100" height="100" rx="23" fill="#007aff"/><g transform="translate(16 16) scale(.68)" style="color:white" fill="currentColor">${marks[i].body}</g></svg>`;composites.push({input:await sharp(Buffer.from(tile)).png().toBuffer(),left:x+360,top:y+355});}
 await sharp(Buffer.from(base)).composite(composites).png().toFile(path.join(__dirname,'new-studies.png'));
 console.log('Created six independent SVG studies and a presentation sheet.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
