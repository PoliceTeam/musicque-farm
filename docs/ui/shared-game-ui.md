# Shared game UI foundation

The current direction is cream paper, warm wood borders, green primary actions and gold selection. This is an implemented review candidate, not an approved art baseline.

## Ownership

- `packages/ui/src/_components/`: React Button, Dialog, Tabs, InventorySlot/Grid, Meter, FormField, GameHeader, ProfileMenu, CurrencyCounter and AudioSettingsPanel; one file per component. See [package guide](../../packages/ui/README.md).
- `packages/ui`: shared theme tokens, button states, panels/dialogs, inventory slot rendering and delegated UI sound intents. No game rules or Phaser dependency.
- `packages/game-audio`: Web Audio lifecycle, semantic effects, separate music/effects volumes, mute and persisted preferences. No app asset imports.
- `apps/game/src/application/game-ui-handler.ts`: composition, gesture unlock and audio asset URL. The settings feature subscribes audio and renders the shared AudioSettingsPanel.
- Each screen retains its layout and commands. Farm, map and character Lab import the shared theme. Map retains existing explicit sound handlers to avoid double sounds.

## Conventions

Import `@chibi-town/ui/theme.css` after screen layout CSS. New UI must use shared tokens rather than introduce a second palette. Use native buttons, selects and modal dialogs; keep visible focus and disabled states. Opening farm dialogs suspends character input. Dialogs support Escape and contain keyboard focus through native `showModal()`.

`installGameUi` emits click, select and close intents. Completed game commands emit success or harvest after state changes. Explicit command handlers opt out with `data-ui-sound="none"`, preventing a second click effect. Disabled buttons do not emit effects.

Inventory slots show only positive quantities. Empty inventory has no selected item, item image or sales action. Reserve detail and command row heights to avoid movement when tabs change.

Music and effects have independent saved controls. Effects briefly lower the music. Existing map mute preferences are retained. Audio starts after interaction and pauses in hidden tabs.

## Review

`/ui.html` displays the common buttons, stock states, dialog and semantic sounds. `/farm.html`, `/map.html` and `/character.html` show actual integration. Custom sprite icons and further texture/detail work can be reviewed separately against this foundation.

Validation: formatting, TypeScript, 187 tests and production build passed. Browser review covered the modal, Escape closing, farm warehouse, map theme and character Lab.

## References

- [Game Accessibility Guidelines: separate volume controls](https://gameaccessibilityguidelines.com/provide-separate-volume-controls-or-mutes-for-effects-speech-and-background-music/)
- [W3C modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)

## Completed common components

- `createUiFeedback`: accessible success/error/info notices (bounded to three), reusable confirmation with price/quantity/balance facts, cancel/Escape, safe text insertion and teardown. Notices move into the active dialog so feedback remains visible in the browser top layer.
- `inventorySlotsMarkup`: existing sprite images, quantity badges, selected and empty slots. Zero inventory never renders an image or sales action.
- `statusMeterMarkup`: labelled native progress bars with bounded values; farm uses growth, food and occupied capacity.
- `withBusyButton`: preserves content, blocks repeated submissions, restores state after asynchronous work.
- Shared theme enforces border-box sizing, 44px controls, visible focus, responsive dialogs, scrolling menus/panels and reduced-motion support.

Farm integration covers purchase/upgrade/sale confirmations, completed action feedback, empty stock, growth/feed/capacity states and semantic sounds. Individual watering/tilling and feeding remain quick actions. Form controls and open modal dialogs block avatar movement. Common skin and click conventions also apply to town and character Lab; map retains its explicit audio routing.

Browser checks used non-persistent farm review data: cancelling a sale preserves 12 items; selling 12 yields 420 coins and empty stock; feeding costs 50 and updates the food meter; pond upgrade 5→6 costs 250; buying a fish costs 100 and yields 1/6 occupied capacity. Maximum capacity hides the upgrade controls. Responsive review covered 390px and desktop layouts. Final automated validation: 187 tests, formatting/lint, TypeScript and production build.

## Farm player header

Farm now groups the equipped-character portrait, default local player name/level, land-tier level, live coins, gem indicator and plot count into a compact HUD. The avatar opens the action dropdown; outside pointer presses and Escape close it, and selecting a farm action closes it. The dropdown is absolutely positioned so it never shifts the title or wallets. Mobile uses a second wallet row.

Portraits reuse existing equipped sprite artwork. User identity/level remain the existing prototype defaults (Bé Chibi, Lv. 1); gems start at zero because there is no account/gem economy yet. The displayed farm tier is 1 + floor((owned plots - 6) / 6), advancing every six opened plots. This display adds no new upgrade price or command.

## Spacing and HUD review (2026-10-11)

Use 8px within a field, 16px panel gutters and group gaps, and 24px for major separation. Shared Button controls have a 44px minimum height; close buttons retain a 44px square target. FormField places its visible label above a full-width control. The farm selection uses `ui-panel-body`, `ui-stack` and `ui-section` to group care, capacity and purchasing; do not add independent margins inside these stacks.

CurrencyCounter uses stable SVG coin/Gem artwork and high-contrast numeric values on dark HUD surfaces. Profile name and level use distinct text sizes, with a dedicated dropdown chevron. Resource counters are informational and do not imply a purchase action. Disabled primary buttons must use the shared disabled palette.

Spacing reference: [Material layout spacing](https://m2.material.io/design/layout/spacing-methods.html). Label/control reference: [GOV.UK select component](https://design-system.service.gov.uk/components/select/). These inform alignment and legibility; the game retains its paper, wood and green visual language.

Farm inventory uses a shared Dialog tabs slot: folder tabs form the outside upper edge of the modal, with one content surface underneath. Switching tabs preserves the measured folder height, avoiding vertical jumps; there is no fixed 640/760px warehouse height. Goods details and sell actions sit immediately below the slot grid.

The kitchen uses a responsive 4/3-column recipe picker with local SVG food illustrations, shared with inventory. Field crops use small shaded plant silhouettes rather than enlarged system emoji. Development route `/farm?review=crops` previews all crop species and stocked inventory without saving.

Inventory product images live in the typed `ProductIcon` registry. Crop, recipe and static sprite sources are resolved once; rendering uses one image branch and one catalog fallback.
