> Boundary note:
> The authorization action-lifecycle direction in this change is still valuable, but any cli-shell-specific terminal assumptions must now be interpreted through `realign-cli-shell-with-core-system-boundaries`.
> In particular, current cli-shell Shell truth must be the TerminalSystem terminal bound to the app session, not a legacy `terminal-2` app ontology.

## Why

Recent cli-shell guard-authorization testing showed a real app symptom: the approval popup appears, but after approval the requested terminal action does not happen immediately. The root cause is architectural, not visual: the current path creates a TerminalSystem approval request and later mints a write lease, while the original `terminal write/input` call has already returned and no waitable terminal action remains to resume.

This change turns the review findings into the next corrective OpenSpec. It keeps cli-shell as a non-core app, but repairs the platform law it depends on: terminal authorization requests, approval, denial, timeout, wait, cancel, and final execution outcomes must be modeled as attention-item-backed terminal action facts rather than ad-hoc app UI state or retry-by-next-model-turn behavior.

## What Changes

- **BREAKING**: Replace the current guard approval behavior where `approveRequest` only mints a future write lease with a waitable terminal action lifecycle.
- **BREAKING**: A guard `terminal write/input` creates one pending terminal action and waits for the manager decision up to a bounded timeout.
- On approval, the original pending action resumes immediately and returns the execution result to the original caller when the call is still waiting.
- On denial, the original call returns a denial warning, preferably including an administrator reason.
- On approval timeout, the call returns a warning plus a terminal-scoped action id that can be used with `terminal wait` or `terminal cancel`.
- Add terminal action states for `waiting_authorization`, `executing`, `succeeded`, `failed`, `cancelled`, and `denied`.
- Add `terminal wait` and `terminal cancel` command/API coverage for pending or executing terminal actions.
- Make approval UI creation, approval, denial, cancellation, timeout, and execution outcome flow through the shared attention-item/commit path.
- Keep approval action state scoped to the live TerminalInstance. Killing, stopping, bootstrapping, or deleting that instance invalidates pending action authority; attention items preserve history but do not resurrect authority.
- Keep cli-shell and WebUI separate products. cli-shell projects only the current bound terminal action request; WebUI may consume the generic terminal-view/TerminalSystem contracts independently.
- Add self-review and BDD coverage gates for cli-shell-related OpenSpec changes, especially around boundary behavior.

## Capabilities

### New Capabilities

### Modified Capabilities

- `terminal-collaboration-access-control`: Guard approval changes from lease-only unlock to a waitable one-action lifecycle with approval, denial, timeout, wait, cancel, and result states.
- `terminal-control-plane`: Terminal input APIs gain action lifecycle, wait, cancel, and live-instance scoped cleanup semantics.
- `runtime-system-kernel-adapters`: Terminal authorization transitions publish through the shared attention-item adapter law instead of app-specific prompt glue or direct UI-only events.
- `cli-shell-app`: cli-shell authorization UI projects current-bound-terminal attention-backed action requests and never changes managed/hosting state or hidden terminal subscriptions as a workaround.
- `terminal-view-component`: terminal view components expose generic permission/action rendering callbacks without becoming the authorization authority.

## Impact

- `packages/terminal-system/src/terminal-control-plane.ts`
- `packages/terminal-system/src/terminal-control-plane.types.ts`
- `packages/terminal-system/src/terminal-db.ts` or a replacement live TerminalInstance action store
- `packages/app-server/src/session-runtime.ts`
- `packages/app-server/src/runtime-system-kernel-adapters/terminal-adapter.ts`
- `packages/app-server/src/runtime-tool-descriptors.ts`
- `packages/app-server/src/trpc/router.ts`
- `packages/client-sdk/src/runtime-store.ts`
- `apps/cli-shell/src/tui/*`
- `apps/cli-shell/src/*`
- `packages/terminal-view/*`
- BDD tests in `packages/terminal-system/test`, `packages/app-server/test`, `apps/cli-shell/test`, and terminal-view/WebUI contract tests where applicable
