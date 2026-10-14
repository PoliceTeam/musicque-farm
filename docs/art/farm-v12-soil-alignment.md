# Farm v12 soil alignment fix

The extracted seeded soil has approximately 30px of transparent padding above its visible top rim, while the other soil assets begin close to the top. Scaling each complete trimmed source independently to 40×40 made seeded soil appear lower and vertically compressed despite equal surface positions.

All six crop stages now share the tilled soil silhouette. Dry soil adds its existing light dry-earth interior and fine fissures; seeded soil adds three small seed marks to the same tilled grooves. Watered and growing stages retain the shared base and root anchor. Source raster files are preserved. Plot texture keys versioned to v12.

Validation: pnpm format; pnpm check (171 tests, 17 tasks); pnpm build (5 tasks). Visual review compared all six states at 40px and 3× side by side: outer rims align. Screenshot ../../../outputs/farm-review/farm-v12-soil-states.png. Live state-transition verification follows below.

Live non-saving farm review completed: dry → till → sow (10 xu) → water; crop remains aligned against adjacent dry plots, growing timer starts at 60s. Seeded map screenshot saved to ../../../outputs/farm-review/farm-v12-seeded-map.png. Test tabs closed; normal saved balance and owned plot count remain 10,525 xu and 7/48.
