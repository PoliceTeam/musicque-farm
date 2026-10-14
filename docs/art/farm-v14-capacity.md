# Farm v14 individual capacity and purchases

Each upgrade adds one place. Livestock starts with 6 empty places, maximum 24; area changes at capacity 10 and 18. Pond starts with 5 empty places, maximum 20; area changes at 10 and 16. Animals/fish are bought separately into available places. Each record stores species and purchase time; new purchases begin young and age offline independently.

## Upgrade prices

Trial prices are shown before each purchase, including construction in the milestone price. Existing 20,000 xu starter balance and crop timers are retained; this change does not implement the separate proposed crop economy or 96-plot layout.

| Target capacity | Livestock price (xu) | Pond price (xu) |
|---|---:|---:|
| 6 | — | 250 |
| 7 | 300 | 325 |
| 8 | 400 | 400 |
| 9 | 500 | 475 |
| 10 | 1100 | 1050 |
| 11 | 700 | 625 |
| 12 | 800 | 700 |
| 13 | 900 | 775 |
| 14 | 1000 | 850 |
| 15 | 1100 | 925 |
| 16 | 1200 | 2000 |
| 17 | 1300 | 1075 |
| 18 | 2400 | 1150 |
| 19 | 1500 | 1225 |
| 20 | 1600 | 1300 |
| 21 | 1700 | — |
| 22 | 1800 | — |
| 23 | 1900 | — |
| 24 | 2000 | — |

Animal prices: hen 150, duck 175, pig 350, sheep 400, cow 550, fish 100 xu. No purchase is accepted when capacity or funds are insufficient. Empty units cannot be fed.

## Existing saves

Legacy herds of 15 and ponds of 5/7/9 are preserved. Previous largest footprint maps to full capacity 24/20; smaller pens receive enough capacity for their existing herd (15), which determines the medium footprint. No money, crops or purchased animals are removed. New capacity/record saves are validated and copied on load; footprint level is derived from capacity.

## Motion and validation

Fish goals and positions have soft spacing inside shore margins, including feeding groups, with bounded travel speed. Livestock tests exercise all-adult 9/17/24 populations at each footprint, including feeding. Development-only review=max shows 24 adults and 20 adult fish without saving; review=upgrades starts empty to verify buying and expanding.

Verified on 2026-10-10: `pnpm check` passed 179 tests across 27 files (17 tasks); `pnpm build` passed all 5 tasks. Live UI review bought a young hen for 150 xu, upgraded capacity 6→10 one slot at a time, and confirmed the footprint expands only at 10 (including the 1,100 xu milestone price). A young fish purchase cost 100 xu and appeared as 1/5 with its own growth stage. The maximum preview displayed 24 livestock and 20 fish; feeding 20 fish charged 25 xu and kept their movement within the pond. The normal legacy save retained 10,525 xu, 7 plots, 15 livestock and 9 fish with 24/20 capacity.

Proof images are saved in the workspace `outputs/farm-review/`: `farm-v14-upgrade-10.png`, `farm-v14-buy-fish.png`, and `farm-v14-max-capacity.png`.
