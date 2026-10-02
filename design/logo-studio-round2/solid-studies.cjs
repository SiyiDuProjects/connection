const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const wr = createRequire(path.resolve(__dirname, '../../web/package.json'));
const sharp = createRequire(wr.resolve('next/package.json'))('sharp');
const marks = [
  { id: 'F01', name: 'Off centre', body: `<path d="M62 14 C34 2 10 22 10 49 C10 75 33 93 58 87 C77 83 88 68 87 50 C86 37 77 31 66 33 C52 35 46 49 52 59 C57 67 68 69 77 59 C72 73 54 80 40 72 C20 61 25 34 44 28 C52 25 58 25 63 28 C68 30 69 18 62 14Z"/><circle cx="82" cy="20" r="9"/>` },
  { id: 'F02', name: 'Between us', body: `<path d="M41 12 C23 12 11 25 11 42 C11 62 23 77 45 84 C38 73 36 65 41 54 C47 42 65 37 65 26 C65 18 55 12 41 12Z M59 88 C77 88 89 75 89 58 C89 38 77 23 55 16 C62 27 64 35 59 46 C53 58 35 63 35 74 C35 82 45 88 59 88Z"/>` },
  { id: 'F03', name: 'A turn toward', body: `<path d="M17 20 C17 15 21 12 26 12 H67 C80 12 88 22 88 34 C88 44 80 49 65 54 L34 66 C29 68 25 64 28 59 L42 34 H25 C20 34 17 30 17 25Z M19 56 C11 62 12 73 18 80 C26 90 40 92 55 86 L80 76 C84 74 86 69 82 66 L76 63 L50 74 C38 79 22 73 23 63 C24 58 23 54 19 56Z"/>` },
  { id: 'F04', name: 'Drawn together', body: `<path d="M40 16 C19 17 9 36 15 53 C21 68 39 76 54 69 C65 64 67 53 62 46 C56 38 45 40 42 48 C37 57 25 54 25 43 C25 29 42 25 51 30 C58 33 62 24 56 20 C52 17 46 16 40 16Z"/><path d="M30 80 C50 92 79 78 84 58 C87 47 85 36 81 31" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><circle cx="77" cy="20" r="9"/>` },
];
const group = (m, color='#252729') => `<g fill="${color}" style="color:${color}">${m.body}</g>`;
const svg = (m) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 100 100">${group(m)}</svg>`;
async function main() {
  for (const m of marks) fs.writeFileSync(path.join(__dirname, `${m.id}.svg`), svg(m));
  const cells=marks.map((m,i)=>{const x=(i%2)*660,y=Math.floor(i/2)*440;return `<g transform="translate(${x} ${y})"><text x="48" y="128" class="label">${m.id}</text><g transform="translate(217 144) scale(2.2)">${group(m)}</g><g transform="translate(48 382) scale(.35)">${group(m)}</g><text x="94" y="409" class="word">reachard</text><rect x="548" y="370" width="62" height="62" rx="16" fill="#007aff"/><g transform="translate(558 380) scale(.42)">${group(m,'white')}</g></g>`;}).join('');
  const board=`<svg xmlns="http://www.w3.org/2000/svg" width="1320" height="920"><style>.label{font:16px Arial;fill:#858991}.word{font:25px Arial;fill:#252729}</style><rect width="1320" height="920" fill="#fff"/><text x="48" y="56" class="word">reachard / shape &amp; space</text>${cells}</svg>`;
  fs.writeFileSync(path.join(__dirname,'solid-studies.svg'),board);
  await sharp(Buffer.from(board)).png().toFile(path.join(__dirname,'solid-studies.png'));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
