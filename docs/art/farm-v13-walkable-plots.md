# Farm v13 walkable crop plots

Removed crop footprints from farm obstacles. Crops stay selectable and retain their stand points and growth states; ownership no longer affects collisions. Both click routing and keyboard movement can cross plots. Water, structures, pen fences and fixtures retain their obstacles.

Validation: pnpm format; pnpm check (173 tests, 17 tasks); pnpm build (5 tasks). Regression tests check a direct route across the crop row at all unit levels, walkable centers of all 48 plots, keyboard motion across the owned row, and existing structural collision/gate behavior. Native UI selected plot 1, reached its stand, then used Up and Left to walk over dry plot 2 and tilled plot 1. Saved balance/ownership remained 10,525 xu and 7/48. Screenshot: ../../../outputs/farm-review/farm-v13-walk-through-plots.png.
