# Farm assets

Runtime files belong to `apps/game/src/assets/farm/`:

- `crops/<crop>/stage-N.webp` and `icon.webp`: planted growth stages and harvested produce.
- `animals/<species>/growth-N.webp`, action frames and `product-N.webp`: only frames consumed by renderers or UI.
- `food/<dish>.webp`: recipe and ingredient pictures.
- `scenery/{buildings,decor,props,structures,terrain,trees}/`: current scene elements.

All runtime farm images use lossless WebP. Original dimensions and every decoded RGBA byte, including transparency, are preserved; no resampling or palette edits were applied. Character/map assets outside this farm migration keep their existing formats.

`tools/farm-runtime-assets.json` is the explicit usage/provenance manifest. Each entry has a stable logical key, source slice, runtime file and a scene preload flag. Renderer/UI code calls `farmAssetUrl` rather than assuming versioned directories or file extensions. Generated `farmSceneUrls` includes only scene inputs; `farmUrls` contains all runtime assets for selectors and the review gallery. Logical keys avoid collisions between `stage-0.webp` files in different plant folders.

## Rebuilding

Source PNG atlases and slicing configuration stay under `docs/art/` and `tools/`. Standalone retired originals are outside runtime under `docs/art/references/farm-retired/`. They are preserved for provenance and possible future review and are never copied into `public/chibi-assets`.

Run:

```sh
python3 tools/build-farm-assets.py
node tools/runtime/prepare-assets.mjs
pnpm check
pnpm build
```

The Python build needs Pillow with WebP support. It regenerates full intermediate source slices in ignored `tools/.farm-export/`, writes only manifest-selected WebPs and verifies decoded RGBA against each slice. This is an artwork maintenance command; ordinary app builds use the committed WebPs and need no Python dependency. Versioned source slicing scripts now write to the scratch directory, not the app asset tree.

When adding assets, update the relevant source slice configuration and the runtime manifest, then rebuild. Mark `scene: true` only for images consumed by the scene renderers. Tests verify crop stages, shop/animal frames, every recipe, physical file existence, no orphan runtime files and exclusion of UI icons from scene preload. Farm WebPs are now static imports in the generated asset module. Next bundles them under `/_next/static/media/<name>.<content-hash>.webp`; canvas/Phaser and UI use those `.src` URLs. They are no longer duplicated in `public/chibi-assets/farm`. Other asset groups retain their existing public pipeline.

## Migration verification — 2026-10-12

- 253 runtime WebPs, 4,854,582 encoded bytes.
- Scene preload: 545 PNGs / 11,488,113 bytes → 193 WebPs / 3,837,272 bytes (66.6% fewer bytes).
- Unused versioned PNG derivatives, old metadata and the unreferenced modular scenery renderer were removed from runtime. Source references and existing review functionality are retained.
- Rebuild verifies every selected source's dimensions and RGBA equality. Check/build pass; this technical verification does not change artwork approval status.

## Next.js cache integration

The installed Next 16.4 documentation recommends static image imports for content hashing and long-lived immutable caching. We use the static loader for original WebP bytes; scene canvases and lossless UI icons do not need resized/re-encoded `/_next/image` responses. This preserves approved pixels while enabling Next's native asset caching. Artwork changes produce new URLs automatically. Development cache behavior differs from production.

Production verification on 2026-10-12 (`next start`, local test port 5174):

- `/_next/static/media/egg-cake.a4457c1c.webp` returned 200.
- `Cache-Control: public, max-age=31536000, immutable`.
- Conditional request using its ETag returned 304.
- Response body exactly matched `food/egg-cake.webp` (10,314 bytes); no resizing or lossy recompression.

Network caching is separate from decoded/canvas/texture caching. The existing animation frame cache and selective scene updates remain necessary for smooth interactions. Future large responsive UI photos may benefit from the `next/image` optimizer; the current farm sprite pipeline retains the original lossless images.

Reference: [Next Image static imports and cache TTL](https://nextjs.org/docs/app/api-reference/components/image#minimumcachettl). Unit tests resolve static imports through Vite source URLs; the production HTTP checks validate the actual Next hash and headers.
