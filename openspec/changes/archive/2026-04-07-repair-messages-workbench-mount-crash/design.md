## Context

`Messages` currently blanks the entire selected workbench window during initial mount. The failure reproduces on `/messages`, `/messages/new`, and `/messages/room/*`, and it occurs before the first room-catalog response finishes. That means the bug is not a bad room payload; it is a mount-path instability inside the message workbench shell itself.

The same application shell can render `Avatars` and `Terminals` correctly, including a reduced `Terminals` case where only the fixed `New terminal` tab remains visible. This narrows the problem to the `Messages` mount/update path rather than the top-level shell.

## Goals / Non-Goals

**Goals**

- Keep the `Messages` workbench chrome renderable during idle and loading room-catalog states
- Repair the mount/update path without introducing a page-local workaround that diverges from shared workbench law
- Add focused regression coverage for the initial `Messages` shell before room data resolves

**Non-Goals**

- Redesign the `Messages` toolbar, room-management flow, or transcript surface
- Change room APIs, room identity semantics, or room hydration ownership
- Rebuild the whole chrome-tabs component for unrelated styling concerns

## Decisions

### The fix should target the unstable chrome composition, not the room payload

The crash occurs before the room catalog response returns, so the change will treat this as a mount/update problem in the message workbench shell. The implementation should keep the fixed `New room` tab and surrounding chrome stable even while `hydrateGlobalRooms()` flips the room catalog from idle to loading.

### Shared workbench composition stays the law; Messages only supplies state

The message route must keep using the shared `WorkbenchWindow` / `WorkbenchTabStrip` primitives instead of forking its own tab chrome. If the current trigger composition proves unstable for the `Messages` mount path, the repair belongs in the shared navigation primitive or in how `Messages` supplies stable tab state to that primitive, not in a message-only duplicate implementation.

### Regression coverage must lock the initial mount path

The fix should add a focused regression that exercises the `Messages` workbench before the first room catalog response resolves. That coverage should assert that the workbench chrome remains mounted and the route does not crash into an empty page.

## Risks / Trade-offs

- [Risk] A message-only workaround could hide a deeper shared tab composition bug. -> Mitigation: keep the repair inside shared workbench composition or a stable `Messages` state contract, and add regression coverage around the mount path.
- [Risk] Tightening trigger composition can regress tab actions such as context menus or close affordances. -> Mitigation: preserve existing workbench-tab behavior and verify the affected routes after the change.
- [Risk] Browser-only reproduction can miss unit-level contract drift. -> Mitigation: add focused automated coverage for the initial `Messages` workbench render path alongside browser verification.
