## Context

`workbench-tab-strip.svelte` is the shared browser-style tab primitive used across the Svelte WebUI. On mobile `Avatars > Settings`, the visible running `jane` tab cannot be selected because the tab's center hit area resolves to the absolutely positioned `Tab menu` button instead of the tab trigger.

The current implementation already tries to hide tab actions for `pointer: coarse`, but real browser evidence shows that device heuristics are not enough. The real constraint is the compact tab geometry, not only the pointer type.

## Goals / Non-Goals

**Goals:**

- Keep narrow workbench tabs selectable on mobile.
- Fix the behavior in the shared tab primitive instead of patching Avatars only.
- Add a focused contract for the compact hit-target law.

**Non-Goals:**

- Redesign desktop tab actions.
- Remove context menus or close actions from roomy desktop chrome.
- Introduce a second mobile-only tab component.

## Decisions

### Compact tab strips hide inline action overlays by container width

When the shared tab strip container is narrow, inline tab actions will be hidden through container-query styling, and the primary trigger will reclaim the right-side padding that used to reserve overlay space.

Alternative considered:

- Continue relying on `pointer: coarse` media queries.
  Why rejected: the reproduced mobile defect already shows that pointer heuristics do not guarantee safe hit targets.

### Fix the primitive, not the page

The bug belongs to the tab strip primitive because the overlay buttons are owned there. The repair will stay in `workbench-tab-strip.svelte` and its contract spec.

Alternative considered:

- Add page-local z-index or spacing workarounds in `Avatars`.
  Why rejected: that would duplicate layout debt and leave `Messages` and `Terminals` exposed to the same failure mode.

## Risks / Trade-offs

- [Risk] Narrow tabs lose inline close/menu affordances. -> Mitigation: preserve those affordances for larger containers where geometry supports them safely.
- [Risk] Padding reset could drift from future tab classes. -> Mitigation: express the narrow-layout law through explicit data attributes and a contract spec.
