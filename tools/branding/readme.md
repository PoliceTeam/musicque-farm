# Chibi Town icons and share image

`source-art/icon-face.png` (head on blue) and `source-art/icon-scene.png` (farm scene) are the user's supplied artwork.

Run `python3 tools/branding/export-icons.py` from the repository root. The deterministic exporter writes
`apps/game/public/favicon.ico` (16/32/48), `icons/icon-{32,192,512}.png` and `icons/apple-touch-icon.png` from the face,
and the 1200×630 `icons/share.png` (Open Graph/Twitter) from the scene. These are PNG/ICO, the documented exception to
the WebP runtime rule, because browsers, iOS and social crawlers do not reliably accept WebP icons. They are declared in
`apps/game/src/app/layout.tsx` metadata and `public/manifest.webmanifest`, not as `app/` icon files, because Next.js turns
those into route handlers whose generated type validator fails this repo's `noUnusedLocals`.

Set `NEXT_PUBLIC_SITE_URL` (public origin plus base path) at build time so share-image URLs are absolute in production.
