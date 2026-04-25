# Self Review: split-terminal-runtime-truth-from-catalog-truth

## Change

- OpenSpec change: `split-terminal-runtime-truth-from-catalog-truth`
- Review date: `2026-04-26`

## Summary Scorecard

| Dimension | Result |
| --- | --- |
| Completeness | `16/16` tasks implemented and documented |
| Correctness | Terminal truth split, lifecycle verbs, no-auto-start law, transport truth, and WebUI projection all have code + test evidence |
| Coherence | Matches the design decision to keep terminal law neutral in `terminal-system` and let app-server / client / WebUI consume projection truth instead of guessing |

## Requirement Evidence

### terminal-control-plane

- Lifecycle operations are explicitly separated in [packages/terminal-system/src/terminal-control-plane.ts](/Users/kzf/Dev/GitHub/jixoai-labs/agenter/packages/terminal-system/src/terminal-control-plane.ts) and [packages/app-server/src/app-kernel.ts](/Users/kzf/Dev/GitHub/jixoai-labs/agenter/packages/app-server/src/app-kernel.ts#L3210).
- Durable lifecycle fields live in [packages/terminal-system/src/terminal-db.ts](/Users/kzf/Dev/GitHub/jixoai-labs/agenter/packages/terminal-system/src/terminal-db.ts).
- BDD coverage lives in [packages/terminal-system/test/control-plane.test.ts](/Users/kzf/Dev/GitHub/jixoai-labs/agenter/packages/terminal-system/test/control-plane.test.ts).

### terminal-pty-transport

- Running-only transport truth is enforced by the control-plane projection in [packages/terminal-system/src/terminal-control-plane.ts](/Users/kzf/Dev/GitHub/jixoai-labs/agenter/packages/terminal-system/src/terminal-control-plane.ts).
- `transportUrl` now projects as a runtime-only fact through [packages/app-server/src/runtime-tool-views.ts](/Users/kzf/Dev/GitHub/jixoai-labs/agenter/packages/app-server/src/runtime-tool-views.ts#L243) and [packages/client-sdk/src/runtime-store.ts](/Users/kzf/Dev/GitHub/jixoai-labs/agenter/packages/client-sdk/src/runtime-store.ts#L403).

### runtime-terminal-contract

- Launch truth, observed identity, lifecycle truth, and running-only activity are projected separately through [packages/app-server/src/session-runtime.ts](/Users/kzf/Dev/GitHub/jixoai-labs/agenter/packages/app-server/src/session-runtime.ts#L7082) and [packages/app-server/src/runtime-tool-views.ts](/Users/kzf/Dev/GitHub/jixoai-labs/agenter/packages/app-server/src/runtime-tool-views.ts#L243).
- Client merge logic preserves field clearing and lifecycle transitions in [packages/client-sdk/src/runtime-store.ts](/Users/kzf/Dev/GitHub/jixoai-labs/agenter/packages/client-sdk/src/runtime-store.ts#L403).

### terminal-surface-projection

- Projection fields are now first-class in [packages/terminal-system/src/terminal-control-plane.types.ts](/Users/kzf/Dev/GitHub/jixoai-labs/agenter/packages/terminal-system/src/terminal-control-plane.types.ts).
- Runtime tool views and realtime invalidation consume the same shape through [packages/app-server/src/session-runtime.ts](/Users/kzf/Dev/GitHub/jixoai-labs/agenter/packages/app-server/src/session-runtime.ts) and [packages/app-server/src/trpc/router.ts](/Users/kzf/Dev/GitHub/jixoai-labs/agenter/packages/app-server/src/trpc/router.ts).

### terminal-system-surface

- Shared display law lives in [packages/webui/src/lib/features/terminals/terminal-display.ts](/Users/kzf/Dev/GitHub/jixoai-labs/agenter/packages/webui/src/lib/features/terminals/terminal-display.ts).
- The display law now explicitly separates terminal entity name from PTY observed window title:
  - tabs / toolbar / dialog identity use `configuredTitle ?? terminalId`
  - terminal window titlebar uses `currentTitle ?? configuredTitle ?? terminalId`
- Toolbar, surface, window title, actions rail, and users dialog consume that projection in:
  - [packages/webui/src/lib/features/terminals/terminal-page-toolbar-content.svelte](/Users/kzf/Dev/GitHub/jixoai-labs/agenter/packages/webui/src/lib/features/terminals/terminal-page-toolbar-content.svelte)
  - [packages/webui/src/lib/features/terminals/terminal-system-surface.svelte](/Users/kzf/Dev/GitHub/jixoai-labs/agenter/packages/webui/src/lib/features/terminals/terminal-system-surface.svelte#L520)
  - [packages/webui/src/lib/features/terminals/terminal-window-surface.svelte](/Users/kzf/Dev/GitHub/jixoai-labs/agenter/packages/webui/src/lib/features/terminals/terminal-window-surface.svelte)
  - [packages/webui/src/lib/features/terminals/terminal-users-dialog.svelte](/Users/kzf/Dev/GitHub/jixoai-labs/agenter/packages/webui/src/lib/features/terminals/terminal-users-dialog.svelte)

## Verification Evidence

### OpenSpec

- `openspec validate split-terminal-runtime-truth-from-catalog-truth --strict`
- Result: passed

### Targeted package verification

- `packages/terminal-system`
  - `bun run typecheck`
  - `bun test test/control-plane.test.ts`
  - Result: passed
- `packages/app-server`
  - `bun test test/runtime-cli.test.ts test/agenter-ai.test.ts`
  - Result: passed
- `packages/client-sdk`
  - `bun test`
  - Result: passed
- `packages/webui`
  - `bun run typecheck`
  - `bun run test:unit -- src/lib/features/terminals/terminal-display.spec.ts src/lib/features/terminals/terminal-system-surface-layout.spec.ts src/lib/features/runtime/runtime-attention-contexts.spec.ts`
  - `bun run test:dom -- test/storybook/terminal-system-surface.stories.test.ts`
  - Result: passed

### Real AI walkthrough

- `AGENTER_RUN_REAL_LOOPBUS=1 bun test test/real-loopbus.integration.test.ts -t "minimal chat request"`
- `AGENTER_RUN_REAL_LOOPBUS=1 bun test test/real-room-terminal.integration.test.ts`
- Result: passed

### Real browser evidence

- Desktop screenshot: `/tmp/agenter-terminal-surface-desktop.png`
- Mobile screenshot (`iPhone 14` width law via `390px` harness args): `/tmp/agenter-terminal-surface-mobile-390.png`
- Notes:
  - This browser evidence used the real Storybook surface harness, not a full app route boot.
  - The integrated backend/runtime contract was covered separately by the real AI walkthrough above.

## Findings

### CRITICAL

- None.

### WARNING

- None judged blocking for this change.

### SUGGESTION

- `packages/app-server` does not currently provide a stable local `typecheck` script like the other packages. This did not block the targeted behavioral verification, but the package-level verification ergonomics are inconsistent.
- If we want a stronger browser acceptance bar later, add a reusable route-level terminal walkthrough that boots the real app shell and reuses the same desktop/mobile evidence flow now used for Storybook.

## Final Assessment

No critical issues found. The change is coherent with the design goal: terminal law is now owned by `terminal-system`, while app-server, client-sdk, and WebUI consume the same separated projection instead of rebuilding truth from stale `cwd/title/running` fields.
