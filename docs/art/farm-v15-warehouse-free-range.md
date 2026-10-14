# Farm v15 — warehouse, free range and menu care

Later UI revisions: empty stock tabs show only a generic empty message, without a selected item or selling controls. Warehouse detail/action rows reserve a stable height so tab switches keep the dialog in place. Seed buying has been removed from the UI at the user's request and is deferred; existing seed stock and sowing remain intact. Entrance arrows were reduced to 42×32 px.

## Harvest and stock

Harvesting a ripe strawberry plot adds one strawberry to persistent warehouse stock and leaves coins unchanged. Lifetime harvest count remains separate. Selling one or all strawberries is an explicit warehouse command (35 xu each). Stock cannot go negative or be sold twice. Warehouse has Goods and Seeds tabs, quantities, empty states and seed purchase (10 seeds / 100 xu). Sowing uses owned seeds first; if no seeds remain, the existing 10 xu direct sow purchase is retained. Existing sold harvests are not recreated as stock, avoiding duplicate rewards.

Click the warehouse building or MENU → Nhà kho to open the inventory. Small cream entrance arrows mark the kitchen and warehouse; the kitchen still has no cooking recipes in this prototype.

## Animal groups and migration

The pen contains cows, pigs and sheep only (24 places maximum). Hens and ducks are moved into a separate free-range flock, with independent capacity (6 initially, maximum 24), purchases and feeding. Each extra free-range place costs `200 + (target - 7) * 75` xu; it does not enlarge the pen. Fish retain 20 places. The free-range flock can roam across the lower lawns and paths, including planted plots, with bounds keeping birds out of the pen, buildings, pond and bottom wall.

Old hens/ducks move out of the shared pen with their purchase timestamps intact. Old places, coins, plot progress and fish remain intact; free-range places are provisioned for the migrated flock. Null food state stays null on subsequent reloads, so feeding cattle does not feed poultry implicitly. Migration supports old herds of up to 24 poultry without losing animals.

Goats and rabbits are not yet added: the current extracted asset set has cow/pig/sheep/hen/duck growth art only. Their future species should use the same pen/free-range classification with dedicated growth artwork, rather than relabeling sheep or chicks.

## Care and movement

MENU → Gia súc / Gà-Vịt / Ao cá opens management immediately, without walking to every animal. At maximum unlocked capacity the upgrade control and world purchase sign disappear; buying animals remains available until those unlocked places are filled. Once full at maximum, the animal purchase control also disappears. Empty flocks cannot be fed.

Animals keep their existing artwork and coat colors. Runtime cached frames articulate the lower leg band with alternating steps, body bob, facing, idle breathing and eating motion. Asset variants are not used as gait frames because some represent different coat colors. All three growth stages use the same animation treatment. Movement animation activates at a lower displacement threshold, so slow motion still shows steps. Fish movement, wakes and water ripples remain.

## Batch care

MENU → Chăm sóc hàng loạt offers till, sow, water or harvest. It builds a queue of all owned plots currently eligible for the chosen action; the character walks across them and executes each command once upon arrival. Ineligible plots are skipped; insufficient seed-buying funds stop the queue. Every completed command is saved. Clicking the map, directional keyboard input, Escape, opening warehouse or selecting another unit stops the queue. Individual plot care is retained.

## Validation

Pure simulation tests cover harvest without automatic selling, stock and seed persistence, explicit sale validation, no duplicate harvest, old animal migration with ages preserved, wrong species rejection, independent feeding and full free-range capacity. Existing footprint, collision, growth and fish-spacing tests remain enabled.

Live browser review confirmed: sell 1 from 12 → 11 stock adds 35 xu; buy 10 seeds from 8 → 18 spends 100 xu; batch harvest of six ripe plots finishes and changes stock 11 → 17 while coins remain 19,935 xu. The maximum preview renders 24 cattle, 24 free-range birds and 20 fish. Test-only review modes never write the user's normal save.

Proof images in workspace `outputs/farm-review/`: `farm-v15-warehouse.png` and `farm-v15-free-range.png`.

Final checks: `pnpm check` passed 182 tests across 28 files, all 17 tasks successful; `pnpm build` passed all 5 tasks. Menu feeding at maximum free-range capacity immediately charged 25 xu, updated fullness to 100%, disabled repeated feeding and showed neither upgrade nor purchase controls.
