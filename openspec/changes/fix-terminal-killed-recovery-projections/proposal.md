## Why

The previous terminal live/history rewrite established the right law, but review found that cold-start recovery and projection consumers can still drift: killed terminals may leave the live list without replaying the attention/runtime consequences, and history/index naming lets product surfaces accidentally treat dead evidence as live candidates.

We need a focused follow-up that makes terminal death converge through one observable pipeline across daemon recovery, runtime attention, client projections, Studio, and cli-shell startup.

## What Changes

- **BREAKING** Tighten terminal killed recovery so daemon cold-start compensation emits the same lifecycle consequence as explicit stop and natural PTY exit.
- **BREAKING** Treat killed terminal bootstrap as an exceptional explicit recovery path rather than the normal "resume this shell" path; product bindings should create a clean new terminal when a previous binding is history-only.
- Require terminal-death attention muting to be caused by a lifecycle attention commit or equivalent kernel ingress, not by product-side direct focus mutation with a fact appended afterward.
- Split or rename client/server terminal projections so live list, killed history, and combined index cannot be confused by product callers.
- Require cli-shell startup selection to list only live cli-shell terminal bindings; killed bindings may be consulted only to avoid product resource-key reuse.
- Require Studio terminal tabs to render only live terminals and route killed terminals into explicit history/index management after refresh or daemon restart.
- Add BDD coverage for daemon cold-start stale-running compensation, attention mute replay, projection separation, and cli-shell/Studio live-only consumers.
- Add a change-local self-review loop: after each implementation pass, compare behavior, tests, docs, and user-facing surfaces back against the original requirement instead of treating green tests as sufficient.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `terminal-control-plane`: Killed flow and daemon recovery must emit one lifecycle-class death consequence and preserve live/history/archive projection boundaries.
- `runtime-terminal-contract`: Runtime recovery must replay killed consequences into runtime attachments, publications, and attention integration after daemon restart.
- `attention-context-state`: Terminal death muting must be causally tied to committed lifecycle ingress rather than an ad hoc state flip.
- `runtime-json-tool-descriptor-surface`: Terminal bootstrap/help guidance must stop presenting killed-history bootstrap as the normal recovery path.
- `runtime-skills-cli-surface`: Built-in terminal skill guidance must prefer new terminal creation over killed terminal reuse unless the caller explicitly chooses forensic recovery.
- `client-runtime-store`: Client terminal APIs must expose live, history, archive, and combined index projections with names that match their semantics.
- `terminal-system-surface`: Studio terminal tabs must be live-only, while killed terminals stay in explicit history/index/archive surfaces.
- `cli-shell-product`: cli-shell startup navigation must use live terminal projection only and must not select killed terminal bindings as reusable Shells.

## Impact

- Affected packages: `packages/terminal-system`, `packages/app-server`, `packages/client-sdk`, `extensions/studio`, and `extensions/cli-shell`.
- Affected APIs: terminal global list/history/index/archive queries, runtime terminal lifecycle descriptors, runtime terminal publications, product binding ensure/reuse behavior, and terminal skill text.
- Affected durable behavior: stale running terminal rows found during daemon restart must complete the same killed post-workflow as live-observed terminal death, including AttentionContext muting and live projection invalidation.
- Affected tests: terminal-system BDD, app-server runtime recovery/attention BDD, client-sdk projection tests, Studio terminal route DOM/contract tests, and cli-shell startup navigation tests.
- Affected workflow: implementation must include repeated self-review checkpoints that map findings back to the user's original terminal lifecycle expectation and update tasks/specs when drift is found.
