# Lucky draw assets

`source-art/wheel-atlas.png` is the UI atlas supplied by the user on 18/10/2026. The exporter crops the plain eight-sector wheel and fixed pointer, removes alpha noise and unrelated connected components, and writes lossless runtime WebP assets.

`source-art/pixie-wings-v1.png` was generated with the built-in ImageGen tool for **Cánh Tiểu Tiên**. The exact prompt is in `source-art/pixie-wings-v1-prompt.txt`. This is new artwork, not a replacement for the existing Cánh Tinh Linh family. The generated alpha is retained for the large UI preview; the native character sprite uses an 88×54 canvas with four wing-width phases and one stable center root. The root is attached behind the character at approximately y=-28; rendering remains behind the body, face and hair.

Run from the repository root:

```sh
python3 tools/lucky-draw/export-assets.py
pnpm --filter @chibi-town/game prepare-assets
```

Sprite writing uses `tools/sprite-source.py`; the private palette lives in `sprites/palettes/pixie-wings.txt`. The exporter does not change other approved artwork. Checked at native size on male/female characters, four walking poses, four animation phases and both facings, and in the actual browser preview. Artwork awaits user review; passing tests are not art approval.
