## Context

`terminal-system` currently spans four different concerns in one execution chain:

1. PTY/xterm runtime orchestration in `packages/terminal-system`
2. durable catalog, grants, approval, and focus state in the same control-plane module
3. app-server/client runtime projection and invalidation
4. WebUI route assembly and terminal-view chrome

That shape makes basic inspection unsafe. A read can implicitly start a process, inject a trusted bootstrap grant, and append activity facts. On the client side, seat state is rebuilt by merging `access + grants + actors`, while the store also does optimistic activity projection and follow-up refreshes. On the WebUI side, the terminal surface duplicates compact/wide user-management logic and clears drafts even when writes fail.

The change is intentionally breaking. Backward compatibility is out of scope; correctness and orthogonality take precedence.

## Goals / Non-Goals

**Goals:**
- Re-establish a clean boundary between runtime execution and catalog/access/projection state.
- Make `terminal_read` / `terminal_snapshot` pure inspection primitives by default.
- Move terminal surface projection to one authoritative server/store path so the WebUI stops rebuilding seat truth locally.
- Reduce `terminal-view` to a viewport primitive and move product chrome to the host surface.
- Replace low-signal source-string tests with BDD integration and Storybook DOM contracts.

**Non-Goals:**
- Preserving the current fat `TerminalControlPlaneEntry` or `TerminalReadResult` shapes.
- Supporting partial compatibility shims for older terminal routes.
- Replacing Bun PTY or xterm as the runtime engine.
- Completing every possible terminal surface cleanup in one patch if a narrower vertical slice is enough to restore the platform law.

## Decisions

### 1. Split runtime truth from catalog/access truth
Create distinct orchestration boundaries:
- `TerminalRuntimeService`: PTY lifecycle, resize, write, snapshot, diff, commit wait.
- `TerminalCatalogService`: durable terminal records, grants, focus, approvals, leases, event history.
- `TerminalControlPlane`: authorization + orchestration facade over those two services.

Why:
- runtime and access state change on different clocks and should not force one another's side effects
- inspection APIs must be able to consult runtime without mutating catalog state

Alternative considered:
- Keep one class and only add helper methods. Rejected because it preserves the existing long-lived blob and does not prevent future cross-layer side effects.

### 2. Make inspection pure by default
`terminal_snapshot` and `terminal_read` become pure inspection operations:
- no hidden bootstrap grant creation
- no implicit terminal start
- no activity append unless explicitly requested
- snapshot returns the full renderable snapshot contract, not just a tail excerpt

Why:
- a debugger/observer must be able to inspect terminal state without changing terminal state
- refresh hydration needs a complete renderable snapshot

Alternative considered:
- Keep the current behavior and add “unsafe read” documentation. Rejected because behavior, not documentation, is the bug.

### 3. Introduce an explicit surface projection contract
Add a dedicated terminal surface projection capability that combines:
- catalog metadata
- runtime snapshot/status
- actor seat projection
- approval counts / activity metadata

The WebUI consumes that projection instead of re-merging `access`, `grants`, and `actors`.

Why:
- the current route has duplicated projection logic that diverges from store and server behavior
- actor-facing labels, access tokens, and seat state belong to one server-produced truth

Alternative considered:
- keep the route merge logic and only add more tests. Rejected because the duplicated projection is itself the architecture defect.

### 4. Move product chrome out of `terminal-view`
`@agenter/terminal-view` becomes a viewport primitive only:
- xterm lifecycle
- snapshot hydration
- live transport updates
- viewport sizing / scroll ownership

Titlebar, footer, metadata text, and decorative shell visuals move to WebUI host components.

Why:
- viewport rendering is reusable infrastructure; product chrome is not
- the current component reads xterm private internals while also owning product presentation, which couples unrelated changes

Alternative considered:
- keep the current shell inside the WebComponent and make it configurable. Rejected because it still couples renderer and product chrome.

### 5. Drive the change with BDD-first vertical slices
Implementation order:
1. add failing terminal-system BDD coverage for inspection purity and approval history
2. refactor control-plane/runtime behavior until those tests pass
3. add failing client/WebUI DOM contracts for draft preservation and projection usage
4. refactor client store and WebUI surface around the new projection

Why:
- the current green suite hides the real bugs because it mostly locks implementation text or isolated segments
- BDD scenarios provide a durable acceptance contract across layers

## Risks / Trade-offs

- **[Risk] Large cross-package blast radius** → Mitigation: implement in vertical slices with stable tests at each layer before moving on.
- **[Risk] Breaking DTO changes ripple through app-server, client-sdk, and WebUI** → Mitigation: update shared types first, then refactor call sites in one worktree without compatibility shims.
- **[Risk] `terminal-view` host split could regress layout or transport restore** → Mitigation: add Storybook DOM contracts for snapshot-first hydration and disconnect handling before moving shell logic.
- **[Risk] Dirty main branch can hide integration mistakes** → Mitigation: keep all work in the isolated worktree and verify from that branch only.
- **[Risk] OpenSpec artifacts drift from implementation during refactor** → Mitigation: update tasks immediately as each vertical slice lands and keep specs limited to changed behavior, not aspirational cleanup.

## Migration Plan

1. Add OpenSpec delta specs and BDD coverage for the new terminal laws.
2. Refactor terminal-system types and control-plane behavior to satisfy pure inspection + approval history tests.
3. Push the new projection shape through app-server and client-sdk.
4. Refactor WebUI route/surface and `terminal-view` host/component around the new contracts.
5. Remove obsolete source-string tests once Storybook DOM and integration tests cover the same behaviors.

## Open Questions

- None for implementation start. The user explicitly approved breaking changes and worktree/OpenSpec execution.
