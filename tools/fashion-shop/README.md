# Ordinary store interior

Source: user-provided `docs/art/fashion-shop/atlas.png`. Run `python3 tools/fashion-shop/export-assets.py`, then the game's `prepare-assets` task. Furniture and decorative pieces are separately reusable. The floor reuses the held-shop floor module. The employee is the `store` role from the shared NPC bank.

The storefront opens `fashion-shop`; the employee opens the existing fashion catalog with direct shirt, pants and shoes tabs. Existing coin prices and first-level-only purchase rules apply. Premium items stay in Premium. Decorative items shown on shelves are scenery, not invented inventory offers.
