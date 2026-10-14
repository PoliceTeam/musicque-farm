# Farm v11 lanes

Shared lawn boundaries now live in FARM_LAWNS in farm-map-data.ts, consumed directly by the ground compositor. The four vertical gaps between pen reservation, three central lawns and pond reservation are 44px; the gap between upper buildings and upper crops matches. The main horizontal lane is 60px (y371..431). Lower lawn edges align at y431 and y663. Grass retains its small organic perimeter variations.

Shifted crop clusters and adjusted building/expanded unit footprints to fit the aligned lanes; character scale, 48 plot IDs, plot size, saved progression and upgrade counts are unchanged. Moved building flowers, supplies and interaction points with their footprints. Pond interaction and livestock buy hitboxes use the updated layout.

Validation: pnpm format; pnpm check (171 tests, 17 tasks), including a new layout regression checking road widths, plot containment and clear lanes with all 48 plots and maximum expansions. Existing all-plot, building, gate, herd spacing and fish bounds tests pass. Native visual review at 1280×720 checks aligned lawns and building/pond rendering. Build and UI route checks recorded on completion below.

Build passed all 5 tasks. UI clicks reached the feeding point inside the pen via the east gate, then crossed to the updated pond stand; both food buttons became enabled on arrival. No food purchases performed. Saved balance remains 10,525 xu, 7/48 plots. Final screenshot: ../../../outputs/farm-review/farm-v11-lanes.png.
