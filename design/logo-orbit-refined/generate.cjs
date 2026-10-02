// Run from the repository root: node design/logo-orbit-refined/generate.cjs
// Derived from Lucide Orbit. See LICENSE.lucide.txt for attribution and terms.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const webRequire = createRequire(path.resolve(__dirname, '../../web/package.json'));
const sharp = createRequire(webRequire.resolve('next/package.json'))('sharp');

const colors = { ink: '#252729', blue: '#007aff', white: '#ffffff' };
const geometry = { orbitRadius: 9.7, centerRadius: 3.3, nodeRadius: 1.65, stroke: 1.55, gapEnd: 102 };
const license = fs.readFileSync(path.join(path.dirname(webRequire.resolve('lucide-react/package.json')), 'LICENSE'), 'utf8');
const point = (r, degrees) => {
  const angle = degrees * Math.PI / 180;
  return [12 + r * Math.cos(angle), 12 + r * Math.sin(angle)].map(n => +n.toFixed(5));
};
function refined(color = colors.ink) {
  const { orbitRadius: r, centerRadius, nodeRadius, stroke, gapEnd } = geometry;
  const trim = 2 * Math.asin(nodeRadius / (2 * r)) * 180 / Math.PI;
  const arc = (from, to) => `<path d="M ${point(r, from).join(' ')} A ${r} ${r} 0 0 1 ${point(r, to).join(' ')}"/>`;
  const node = angle => { const [cx, cy] = point(r, angle); return `<circle cx="${cx}" cy="${cy}" r="${nodeRadius}"/>`; };
  return `<g fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${arc(-45 + trim, gapEnd)}${arc(135 + trim, gapEnd + 180)}<circle cx="12" cy="12" r="${centerRadius}"/>${node(-45)}${node(135)}</g>`;
}
function original() {
  return `<g fill="none" stroke="${colors.ink}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.341 6.484A10 10 0 0 1 10.266 21.85"/><path d="M3.659 17.516A10 10 0 0 1 13.74 2.152"/><circle cx="12" cy="12" r="3"/><circle cx="19" cy="5" r="2"/><circle cx="5" cy="19" r="2"/></g>`;
}
const notice = `<!-- Derived from Lucide Orbit\n${license.replaceAll('--', '—')}-->`;
const wrap = (body, box = '-3 -3 30 30') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" width="1024" height="1024">${notice}${body}</svg>`;
const place = (body, x, y, size) => `<g transform="translate(${x} ${y}) scale(${size / 24})">${body}</g>`;
const label = (x, y, text, size = 18, color = colors.ink) => `<text x="${x}" y="${y}" fill="${color}" font-family="Arial, sans-serif" font-size="${size}">${text}</text>`;

async function main() {
  fs.writeFileSync(path.join(__dirname, 'LICENSE.lucide.txt'), license);
  const assets = {
    'reachard-mark-dark': wrap(refined()),
    'reachard-mark-white': wrap(refined(colors.white)),
    'reachard-mark-blue': wrap(refined(colors.blue)),
    'reachard-icon-blue': wrap(`<rect width="32" height="32" rx="7" fill="${colors.blue}"/><g transform="translate(6 6) scale(${20 / 24})">${refined(colors.white)}</g>`, '0 0 32 32'),
  };
  for (const [name, svg] of Object.entries(assets)) {
    fs.writeFileSync(path.join(__dirname, `${name}.svg`), svg);
    await sharp(Buffer.from(svg)).png().toFile(path.join(__dirname, `${name}.png`));
  }
  for (const size of [16, 24, 32, 48, 128]) {
    await sharp(Buffer.from(assets['reachard-icon-blue'])).resize(size, size).png().toFile(path.join(__dirname, `icon-${size}.png`));
  }
  const iconBody = `<rect width="24" height="24" rx="5" fill="${colors.blue}"/><g transform="translate(4.5 4.5) scale(.625)">${refined(colors.white)}</g>`;
  const sizeRow = [16, 24, 32, 48].map((s, i) => place(refined(), 580 + i * 105, 680, s) + label(580 + i * 105, 755, `${s}px`, 14, '#70747a')).join('');
  const board = `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="840" viewBox="0 0 1440 840">${notice}<rect width="1440" height="840" fill="white"/>${label(70, 70, 'reachard / mark refinement', 26)}${label(70, 110, 'Orbit structure retained. Lighter strokes. Smaller nodes. Larger center.', 18, '#70747a')}${label(115, 205, 'CURRENT', 14, '#70747a')}${label(575, 205, 'REFINED', 14, '#70747a')}${label(1035, 205, 'APP ICON', 14, '#70747a')}${place(original(), 105, 265, 240)}${place(refined(), 565, 265, 240)}${place(iconBody, 1025, 265, 240)}${label(70, 665, 'Actual-size checks', 20)}${label(70, 700, 'Refined mark at native pixel sizes', 16, '#70747a')}${sizeRow}</svg>`;
  fs.writeFileSync(path.join(__dirname, 'comparison.svg'), board);
  await sharp(Buffer.from(board)).png().toFile(path.join(__dirname, 'comparison.png'));
  console.log(`Generated editable SVGs, PNG exports and comparison in ${__dirname}`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
