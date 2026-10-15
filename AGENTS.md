# Architecture

New filenames use kebab-case. Component directories are named `_components/` and utility directories `_utils/`, in both app features/routes and shared packages. Keep feature-private code beside its owner; public package imports continue through package exports. Do not create empty component or utility directories. Prefer functions; simulation state is an object passed explicitly into update/command functions. Keep classes where they serve Phaser or rendering lifecycle, or existing encapsulated avatar animation. Use `@/` imports for modules under `apps/game/src/`; the alias is configured in TypeScript and Vite/Vitest. Follow `docs/phaser-migration.md` for the agreed target structure and logic/handler/view boundaries. Keep logic free of DOM/Phaser/storage imports; handlers own event registration and cleanup, and views own drawing. The structural refactor is applied; town and all four Lab panels now use Phaser, including native particles, ornament tweens and animation clocks.

# Art assets

Before generating or changing any character, hair, hat, pet or wing artwork, read `docs/approved-art-rules.md`. It records the user's accepted baselines, rejected directions and shared visual rules. Keep its approval status accurate; a passing build or visual inspection is not user approval.

When adding or changing character hair, read `docs/hair-workflow.md` and `docs/art-guide.md` first. Keep approved raster artwork when fixing attachment, masks or offsets. Store source art and deterministic export configuration in the repository; do not leave required inputs only in a temporary directory.

Judge pixel assets at native game size as well as enlarged. Check silhouettes, palette clusters, transparent gaps, face variants, all poses and both facings. A passing topology test does not replace visual review.

For pet/wing work, also read `docs/pet-wing-review.md`. Distinguish canvas interpolation from detail already lost in the source sprite. Keep runtime animation anchors consistent. Use the existing check/build commands after asset integration.

# Toolchain

Use pnpm from the repository root; do not create npm/yarn lockfiles. The app lives in `apps/game/`. `pnpm check` runs Biome formatting, lint/import checks, TypeScript and tests via Turbo; `pnpm build` builds both entries. Run `pnpm format` after code changes. The root format command also enforces one blank line around named function definitions (including arrow functions and methods) using the TypeScript parser. `pnpm format:check` checks this rule; keep attached comments and overload signatures with their definitions. Root `biome.json` excludes approved art data and exporter configuration; keep them byte-for-byte unless an art change is authorized. Biome uses its recommended preset, with non-null assertions allowed for validated data and fixed DOM/canvas contracts; TypeScript remains strict.

# Shared character package

`packages/character-core/` owns character types, item/color/pet metadata and outfit/layout/animation logic. It must not import app modules, Phaser, DOM, storage or sprite text. App consumers use public `@chibi-town/character-core/<module>` exports; core internal imports use relative `.js` extensions for Node ESM. Keep sprite parsing, resources and rendering in `apps/game/`. Run checks for both workspaces after changing this boundary.

# Renderer providers

`packages/render-contracts/` owns engine-neutral renderer types, per-app registry and native sprite pixels. `packages/renderer-phaser/` contains all Phaser imports and scene/view/texture lifecycle; `packages/renderer-canvas/` implements the same preview contract. Neither adapter imports app modules or simulation rules. Keep engine types out of public contracts. App composition selects providers through `game/rendering/renderer-providers.ts`; town and Lab compose the same Phaser provider; Canvas is retained for wardrobe thumbnails, static texture baking and legacy preview adapter tests; it does not support native effects.

# Sprite source groups

Source sprites use `apps/game/src/assets/sprites/<category>/<family>/sprites.txt`, with frames/levels/width variants kept together. Palette-only files are loaded first; character, pet and scenery namespaces remain separate. Use `tools/sprite-source.py` from exporters instead of writing legacy monolithic files. Metadata stays in character-core. Read `docs/sprite-sources.md` before adding groups; preserve IDs and the pixel/palette baseline for structural changes. The loader discovers nested .txt files automatically.

# Locale

New user-facing React text uses typed `react-i18next` keys from `apps/game/src/application/i18n/locales/vi/`. Group keys by namespace (`common`, `farm`, `inventory`, `settings`); use interpolation for dynamic values, never sentence concatenation. The persistent application shell owns a separate i18next instance per mount. Shared UI receives translated labels through props and stays independent of game locale. Keep business IDs and SDK payloads language-neutral. Existing legacy character/map/renderer text is migrated when touching those screens; do not claim all screens are translated yet.

# Application source layout

Next.js routes/layout live in `apps/game/src/app/`. `src/application/` owns the persistent shell, SDK initialization, locale and UI services. Screens, stores and private helpers belong in `src/features/<feature>/`; farm rendering/runtime stays with farm, character tooling stays with character. `src/game/` contains shared movement/runtime/rendering only. Sandbox/showcase/art-review screens live in `src/devtools/`. Do not recreate legacy top-level farm/map/lab/ui/world/state/composition directories or gameplay re-export wrappers; consume package exports directly. See `docs/target-architecture.md`.

# Backend

`apps/api/` is the Fastify + PostgreSQL server; read `docs/backend.md` before changing it. `packages/game-service/` owns every `GameSdk` operation as a function on a `PlayerDocument`; it must not import storage, DOM, Phaser, Fastify or database modules. The local adapter and the server both call it, so change game rules or command handling there, never in one caller only. The server takes the player id from the session cookie, never from a request body. Schema changes go through `pnpm --filter @chibi-town/api db:generate`; do not edit `apps/api/drizzle/` by hand. API tests run on PGlite and must not need a running database.

Backend feature code belongs in `modules/auth`, `player`, `character`, `inventory`, `farm`, `arcade`, `world`, or the SDK compatibility module `commands`; technical database/Redis/hub code belongs in `infrastructure`, and WebSocket transport in `application`. Within a module use `index.ts`, `routes.ts`, `controller.ts`, `service.ts`, and `repository.ts` only where needed. `index.ts` wires the Fastify plugin and exports the module's public API; routes declare HTTP paths; controllers map request/response; services coordinate rules and transactions; repositories own SQL. Small modules may omit layers. Cross-module production imports use the owner's index; module-private helpers stay beside the owner. `arcade/tables` is a submodule for the separately stored PvP tables. Do not recreate `GameContext`, `runPlayer`, `runInventory`, or a registry of prepare callbacks: call named service methods directly. The protected Fastify scope authenticates once and supplies `request.player`; public auth and WebSocket origin validation remain in their own scopes. Player transactions do not hydrate inventory implicitly: use `withCharacterInventory` for inventory/outfit/shop commands. Shared `game-service.ts` is composition only; domain functions own the rules. Shared command coordination retains receipts, revision and reserved-wallet checks for both local and server. Keep files focused on one responsibility, without adding generic framework layers or splitting purely to meet a line count. See `docs/backend.md` for the debug path and request tracing.

Use extensionless `@/` imports for modules under `apps/api/src/`, including imports from API tests. TypeScript and Vitest resolve the alias; the API build runs `tsc-alias` after `tsc` to emit relative `.js` imports for Node ESM. Use the workspace build command, not standalone `tsc`, to produce runnable API output. Shared packages keep their existing public exports and relative `.js` internal imports.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

# CSS ownership

Keep screen-specific styles beside the feature that owns them. `packages/ui/src/theme.css` owns shared controls and layout; it must not accumulate account or game-specific selectors. Account form and character-setup styles live in `apps/game/src/features/auth/auth.css`. Arcade game styles belong to `packages/arcade-games-react/src/theme.css`. Runtime stylesheet generation is declared in `tools/runtime/prepare-assets.mjs`; generated CSS modules are build artifacts and must not be edited manually. See the stylesheet ownership table in `docs/target-architecture.md`.
