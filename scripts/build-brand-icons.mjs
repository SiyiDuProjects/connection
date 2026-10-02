import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const webRequire = createRequire(new URL('../web/package.json', import.meta.url));
const sharp = createRequire(webRequire.resolve('next/package.json'))('sharp');
const master = await readFile(new URL('brand/mark.png', root));

// Mechanical exports of the approved master: preserve its pixels and alpha.
const outputs = [
  ['web/public/images/brand/reachard-logo-mark.png', 512],
  ['web/app/icon.png', 256],
  ['web/app/apple-icon.png', 180],
  ['extension/icons/reachard.png', 128],
  ...[16, 32, 48, 128].map(size => [`extension/icons/icon-${size}.png`, size]),
  ['artifacts/launch-20260907/store/assets/store-icon-128.png', 128],
];
for (const [name, size] of outputs) {
  const destination = new URL(name, root);
  await mkdir(new URL('./', destination), { recursive: true });
  await sharp(master).resize(size, size).png().toFile(fileURLToPath(destination));
}

const sizes = [16, 32, 48];
const pngs = await Promise.all(sizes.map(size => sharp(master).resize(size, size).png().toBuffer()));
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
for (let index = 0; index < sizes.length; index++) {
  const entry = 6 + index * 16;
  header[entry] = sizes[index];
  header[entry + 1] = sizes[index];
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(pngs[index].length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += pngs[index].length;
}
await writeFile(new URL('web/app/favicon.ico', root), Buffer.concat([header, ...pngs]));
console.log(`Exported ${outputs.length} PNG icons and the multi-size favicon from brand/mark.png.`);
