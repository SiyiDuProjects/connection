# Brand assets

Edit `brand.json` to change the display name once. The default spelling is
`Reachard`; the icon and lettering are independent.

`reference.png` is the image supplied for this launch. `mark.png` is the selected
transparent, icon-only master, extracted with the built-in image generation
tool. The website, extension, favicon and store icon exports preserve its alpha.

Selected extraction prompt:

> Use case: background-extraction. Edit target: the supplied Reachard brand image.
> Extract ONLY the large blue symbol from the top center, preserve its exact
> asymmetric rounded shape, internal circular keyhole opening and diagonal
> opening toward bottom-right. Produce one isolated crisp blue logo symbol on
> actual transparent background, square canvas with roughly 10 percent clear
> padding. Preserve the reference blue #007aff and flat silhouette, remove all
> off-white background, all wording, and the small lower duplicate. No text of
> any kind. No redesign, no new geometry, no shadow, no embossing, no gradient,
> no checkerboard baked into pixels. The empty hole and the outside must be
> genuinely transparent. This is the production icon asset for website and
> Chrome extension; fidelity to the supplied shape is essential.

Mechanical exports: `node scripts/build-brand-icons.mjs`.
Display-name/runtime synchronization: `node scripts/sync-brand.mjs`.
Plugin build: `node scripts/build-extension-ui.mjs`.

After changes, rebuild the store package and screenshots. Published store fields
and external provider settings still need their normal publication/update step.
