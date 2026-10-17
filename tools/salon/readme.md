# Salon interior

The transparent user-supplied atlas and reference room are retained under `docs/art/salon/`. Run `python3 tools/salon/export-assets.py` from the repository root with Pillow installed. Runtime assets are lossless WebP; crop coordinates are stored in `assets.json`.

The map composes floor and wall tiles, doors, salon mirrors, reception counter with the supplied employee, furniture and plants. It does not use the reference room as a baked background. Floor/wall modules have no transparent gutters so they tile continuously. Other props retain transparent padding, and deterministic component masks remove neighbouring atlas fragments. The U-shaped counter wings are joined onto the central counter without stretching source pieces.

`center/salon` is an interior in the Center registry, entered through the salon storefront on Shopping Street. The shared location runtime owns movement, camera, presence and the common header. The counter opens `ShopDialog`; the exit returns to the storefront. The world map lists the shopping street, not individual shop interiors.

`features/shop` owns the shop UI and local trial outfit only. Contracts/game-service own store filtering, offers, authoritative coin prices, ownership and purchase/equip commands. See `docs/cosmetic-economy.md` for the income audit, normal/Premium prices and upgrade-only policy.
