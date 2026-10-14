# Farm v7: growth and motion candidate

Con non → đang lớn → trưởng thành. Timings are prototype game values: cattle/pigs/sheep 5/15 minutes, poultry 3/9 minutes, fish 4/12 minutes. The sample herd contains mixed starting ages so all states can be inspected immediately. One saved cohort start timestamp advances ages offline without resetting after reload; older saves migrate without losing crops or currency. These visuals do not yet implement feeding, disease, breeding or production.

Young calf/pig/lamb/duck sprites come from built-in ImageGen, using farm-v4-asset-reference.png as style reference. Source: farm-v7-baby-atlas.png. Export: tools/export-farm-v7.py (2×2 grid, alpha trim). Chicken chick art and adult art retained. Juvenile uses the young silhouette at an intermediate size. Native feet anchor shared across all stages. Art is a review candidate, not user approved.

Animals use deterministic irregular destinations with smooth travel, independent pauses, facing, gait bob/sway, and bounded footprints. Safe roaming area excludes the shelter and feed/water line. Fish swim to independent destinations with slight fin/body pulse, varied speed, and age-scaled bodies. All destinations and interpolated positions remain within the enclosure/water after expansion. No growing texture keys over time: pre-baked finite gait/heading/stage frames.

Dry soil uses the existing common soil frame with a lighter dusty interior and branching fissures; same 40×40 footprint as tilled/seeded/wet states.

Validation: 166 tests passed, including lifetime save migration, all livestock footprints sampled across 3 minutes/all expansion sizes and fish shoreline bounds. Browser reviewed the 6 soil/crop stages, 3 stages for each of 5 livestock species in both facings, and 3 fish sizes. Live farm verified animal/fish motion and panel age counts. Proof images: outputs/farm-review/farm-v7-motion.png and farm-v7-growth-states.png in the parent workspace.

## Feeding and entrance

The enclosure now has an east-facing 72px opening at y354–426. Its floor is walkable; collision follows the remaining fence, shelter, troughs and egg basket. Interaction point is inside, below the feeding trough. Routes in and out are tested at all three expansion levels.

Whole-herd feeding costs 50 xu and fish feeding 25 xu (prototype balance). Fullness lasts five minutes, saves its timestamp, depletes offline, and permits refill at 25% or below. Failed, duplicate and insufficient-balance commands never charge. Animals/fish smoothly approach food for twenty seconds, then resume roaming. Food does not yet gate growth or produce eggs/milk: those remain the next care/production gameplay steps.

Feeding validation: 169 game tests/check passed. UI tested an unsaved temporary farm: walk through the entrance to the trough; herd feeding 20,000 → 19,950 xu, fullness 100% and repeat button disabled; exit through gate and reach pond; fish feeding subtracts 25 xu and disables duplicate feeding. Live checks do not spend the user's saved farm balance. Feeding doesn't unlock fish harvesting yet.
