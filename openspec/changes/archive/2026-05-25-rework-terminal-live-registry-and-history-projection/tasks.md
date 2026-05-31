## 1. Durable law updates

- [x] 1.1 Rewrite terminal lifecycle specs around live/history/archive projection instead of durable stopped-live identity.
- [x] 1.2 Update runtime, attention, CLI, and terminal-system UI specs so they all describe the same killed/history law.
- [x] 1.3 Sync package-level durable docs (`SPEC.md` files) once implementation lands so the long-term law matches the archived change.

## 2. Terminal-system projection refactor

- [x] 2.1 Introduce one-table live/history/archive projection queries in `packages/terminal-system`.
- [x] 2.2 Refactor lifecycle storage so terminal death routes through one shared killed pipeline.
- [x] 2.3 Make daemon cold-start recovery replay the killed pipeline for stale running instances instead of only normalizing storage state.
- [x] 2.4 Define archive/delete behavior over durable terminal-instance metadata plus terminal-owned output evidence.

## 3. Runtime and attention integration

- [x] 3.1 Update app-server runtime terminal recovery and publication logic to treat killed terminals as history-only.
- [x] 3.2 Route terminal death through the adapter/attention path so the bound attention context is durably moved to `muted`.
- [x] 3.3 Remove stale live-terminal assumptions from runtime caches, focus bindings, and terminal-facing projections.

## 4. CLI and skill surface updates

- [x] 4.1 Add descriptor-backed runtime commands for `terminal history`, `terminal archive`, and the revised `terminal delete` semantics.
- [x] 4.2 Update runtime CLI help and built-in terminal guidance so `terminal list` is live-only and history management is explicit.
- [x] 4.3 Update any app/runtime consumers that currently rely on stopped terminals remaining in the default list.

## 5. UI and app surfaces

- [x] 5.1 Rework terminal-system UI so killed terminals leave the main live route and appear in explicit history/archive management surfaces.
- [x] 5.2 Update terminal-facing app surfaces to handle live-terminal disappearance without silently targeting stale dead instances.

## 6. Verification

- [x] 6.1 Add BDD tests for explicit stop/kill, natural exit, and daemon cold-start compensation all converging on the same killed flow.
- [x] 6.2 Add BDD tests proving terminal death mutes the bound attention context and removes the instance from live queries.
- [x] 6.3 Add BDD tests for `terminal history`, `terminal archive`, and `terminal delete` over durable transcript evidence.
- [x] 6.4 Run focused terminal-system/app-server verification plus manual runtime/AI walkthroughs against stale-terminal recovery cases.
