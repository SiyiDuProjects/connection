import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const webRequire = createRequire(path.join(root, 'web/package.json'));
// Reuse the esbuild version already installed by the web tooling.
const esbuild = createRequire(webRequire.resolve('drizzle-kit'))('esbuild');
const postcss = webRequire('postcss');
const tailwind = webRequire('@tailwindcss/postcss');
const ariaRequire = createRequire(webRequire.resolve('react-aria-components'));
const source = path.join(root, 'extension-ui/styles.css');
const result = await postcss([tailwind({ base: path.join(root, 'extension-ui'), optimize: true })]).process(await readFile(source, 'utf8'), { from: source });
// Chromium does not register @property declarations inside a ShadowRoot.
// Supply Tailwind's translation initial values in its lowest-priority layer,
// so native indicators can resolve translate(x, y) instead of dropping it.
result.root.prepend(postcss.atRule({ name: 'layer', params: 'properties' }));
result.root.append(postcss.atRule({ name: 'layer', params: 'properties', nodes: [
  postcss.rule({ selector: '*, ::before, ::after', nodes: ['x', 'y', 'z'].map(axis =>
    postcss.decl({ prop: `--tw-translate-${axis}`, value: '0' })) })
] }));
// Theme aliases must resolve on the same element as HeroUI's .default variables.
// Resolving e.g. --radius-3xl on :host before --radius exists makes it invalid,
// which otherwise strips radii and shadows from portaled menus.
const heroTheme = postcss.parse(await readFile(path.join(root, 'web/node_modules/@heroui/styles/dist/themes/shared/theme.css'), 'utf8'));
const aliases = [];
heroTheme.walkAtRules('theme', rule => {
  for (const node of rule.nodes || []) if (node.type === 'decl') aliases.push(node.clone());
});
result.root.append(postcss.atRule({ name: 'layer', params: 'theme', nodes: [
  postcss.rule({ selector: '.default', nodes: aliases })
] }));
// rem units cross Shadow DOM boundaries and inherit the visited site's html font size.
// Fix the component scale at 16px so sites using a 10px root cannot shrink control text.
result.root.walkDecls(declaration => {
  declaration.value = declaration.value.replace(/(-?(?:\d*\.)?\d+)rem\b/g, (_, value) => `${Number(value) * 16}px`);
});
await writeFile(path.join(root, 'extension-ui/compiled.css'), result.root.toString());
await esbuild.build({ entryPoints: [path.join(root, 'extension-ui/index.jsx')], outfile: path.join(root, 'extension/ui.js'), bundle: true, minify: true, format: 'iife', platform: 'browser', target: ['chrome120'], jsx: 'automatic', nodePaths: [path.join(root, 'web/node_modules')], alias: { 'react-aria/useInteractOutside': ariaRequire.resolve('react-aria/useInteractOutside'), 'react-stately/private/flags/flags': ariaRequire.resolve('react-stately/private/flags/flags') }, loader: { '.css': 'text', '.png': 'dataurl' }, define: { 'process.env.NODE_ENV': '"production"' }, legalComments: 'eof' });
console.log('Built extension/ui.js with React + HeroUI; CSS is embedded in the isolated Shadow DOM.');
