# Self Review

## Change

- Change: `fix-shell-next-pty-aware-selection-routing`
- Schema: `vision-driven`
- Review result: normal exit; archive intentionally left for user acceptance.

## Spec Alignment

- `TerminalMouseTrackingState` is now a backend/frame fact with `protocol: none | vt200 | drag | any` and `encoding: default | sgr`.
- `XtermBridge` derives mouse tracking from PTY output DECSET/DECRST sequences `1000`, `1002`, `1003`, and `1006`.
- `@agenter/termless-backend-utils` owns PTY-aware pointer routing and returns explicit pointer effects: `none`, `selection`, `selection-finalized`, and `pty-mouse`.
- Shell-Next projects both backend-absolute selection coordinates and viewport-local PTY coordinates. It passes `sourceStartRow` from `viewportStart`.
- Primary selection mirroring now only follows `selection-finalized`, not any handled pointer-up.

## Code Review

- Platform law moved down: mouse ownership is decided from backend mouse tracking state, not Shell-Next global UI state.
- The existing `Intl.Segmenter` word selection path was preserved; double-click fixes are projection/routing fixes.
- Triple-click line selection remains on the existing semantic-selection path.
- SGR and default xterm mouse encoding are covered, including wheel routing.
- Shift pointer events bypass PTY routing when delivered by the host and use selection instead.

## Evidence

- `bun run openspec:vision -- commit-check fix-shell-next-pty-aware-selection-routing --phase apply`: passed, latest spec commit `d5698f30`; `bun.lock` reported as unrelated dirty.
- `bun test packages/termless-backend-utils/test/terminal-host-input.test.ts packages/termless-core/test/terminal-interaction.test.ts packages/terminal-transport-protocol/test/terminal-transport-protocol.test.ts packages/terminal-system/test/control-plane.test.ts apps/shell-next/test/terminal-view-renderable.test.ts apps/shell-next/test/shell-next-app.test.ts --test-name-pattern "mouse|selection|drag|primary|interaction|scrollRows|row-cache|PTY|pty"`: 54 pass, 0 fail.
- `bun run --filter '@agenter/termless-backend-utils' typecheck`: passed.
- `bun run --filter '@agenter/terminal-transport-protocol' typecheck`: passed.
- `bun run --filter '@agenter/terminal-system' typecheck`: passed.
- `bunx tsc --noEmit -p packages/termless-core/tsconfig.json`: passed.
- `bun run openspec:vision -- validate fix-shell-next-pty-aware-selection-routing`: passed.
- `bunx prettier --check` on touched TS files: passed.
- `git diff --check -- . ':(exclude)bun.lock'`: passed.

## Known External Drift

- `bun run --filter 'agenter-app-shell-next' typecheck` is blocked by current branch Room/MessageRecord type drift: `senderActorId`, `readActorIds`, and missing `MessageControlPlaneEntry.superKey/createdBySystemId`. These errors are outside the Shell-Next terminal selection/mouse path and were not introduced by this change.
- `bun.lock` remains dirty and is intentionally excluded from staging.

## Remaining Risk

- Outer host terminal mouse enablement remains outside this change. This change handles events once Shell-Next receives them.
- Default mouse encoding is implemented for compatibility; coordinates are clamped to the legacy byte range.
