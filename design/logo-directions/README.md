# Reachard logo selection

96 distinct geometric studies. IDs 01–48 retain their original structures; 49–96 are additional concepts. These are exploration drafts, not deployed brand assets.

All exported symbols are centered by rendered alpha bounds and scaled to the same maximum visible extent (76 units in a 100-unit square), preserving each symbol's aspect ratio. The share sheets use identical cells, symbol sizes, color and labels, with no recommendations to bias selection.

- `share-all-96.png`: all 96, 1600 × 2510.
- `share-01-48.png` and `share-49-96.png`: two pages, each 1600 × 1310.
- `svg/01.svg` through `svg/96.svg`: editable vector files.
- `index.html`: standalone gallery with selection, color preview and SVG downloads. It can be opened locally without a server.

Regenerate the expanded, normalized assets with `node design/logo-directions/generate-share.cjs`. `concepts.cjs` is the geometric source; `concepts.json` contains normalized exports. The gallery shell must exist at `index.html` (the older `generate.cjs` can recreate the shell, after which `generate-share.cjs` must be run).

Preview: `node design/logo-directions/serve.cjs`, bound to 127.0.0.1:8885. Share the PNG files with friends; the localhost preview address only works on this machine.
