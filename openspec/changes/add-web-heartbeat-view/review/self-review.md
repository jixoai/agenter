# Self Review: add-web-heartbeat-view

## Scope

This apply implements the first standalone `@agenter/web-heartbeat-view` slice:

- package-owned Heartbeat parser/materialization/rendering
- host-neutral `HeartbeatView` and Framework7-compatible `HeartbeatPage`
- `readonly | configable` statusbar action mode
- standalone Framework7 example with Avatar directory and Heartbeat route
- existing client-sdk connection path with `createSession({ autoStart:false })`
- no backend endpoint changes
- no Studio migration

## Result

Pass for first-phase example acceptance. Studio migration remains explicitly deferred until the example is accepted by the user.

## Verification

- `bun run --filter '@agenter/web-heartbeat-view' typecheck`: pass, 0 errors, 0 warnings
- `bun run --filter '@agenter/web-heartbeat-view' test`: pass, 3 unit files / 15 tests, 1 Storybook browser test, 1 DOM browser file / 5 tests
- `bun run --filter '@agenter/web-heartbeat-view-example' typecheck`: pass, 0 errors, 0 warnings
- `bun run --filter '@agenter/web-heartbeat-view-example' test`: pass, 1 file / 6 tests
- `bun run openspec:vision -- validate add-web-heartbeat-view`: pending after task update

## Browser Evidence

- Mobile directory: `.screenshot/web-heartbeat-view/mobile-directory-latest.png`
- Mobile readonly Heartbeat: `.screenshot/web-heartbeat-view/mobile-heartbeat-latest.png`
- Mobile configable Heartbeat: `.screenshot/web-heartbeat-view/mobile-configable-latest.png`
- Desktop directory: `.screenshot/web-heartbeat-view/desktop-directory-latest.png`
- Desktop Heartbeat: `.screenshot/web-heartbeat-view/desktop-heartbeat-latest.png`

The connected local daemon returned three Avatars and loaded-empty Heartbeat data for each tested Avatar. That is a valid DB-truth state: the page remains an honest target and shows `No live push is active` rather than treating non-running Avatars as unavailable.

## Drift / Follow-up

- Studio still owns its current Heartbeat route. This is intentional for first phase.
- After user acceptance of `@agenter/web-heartbeat-view:example`, plan a follow-up migration where Studio imports the package through a thin adapter.
- If richer demo data is needed, seed or run an Avatar so grouped Heartbeat rows exist in the local daemon DB before acceptance review.
