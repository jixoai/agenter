## 1. Contract and Durable Truth

- [x] 1.1 Upgrade terminal-system profile and projection types from `rendererEngine` to durable `rendererPreference` plus declarative `theme` and `cursor`, and define the concrete resolved-renderer vocabulary.
- [x] 1.2 Remove AI-facing renderer/theme mutation authority from runtime terminal config descriptors while preserving read visibility where required.
- [x] 1.3 Update client/runtime projection contracts and durable spec text so renderer preference, resolved renderer facts, and theme metadata are explicit and recoverable.

## 2. Shared Viewport Adapter Layer

- [x] 2.1 Introduce a shared renderer resolver and `TerminalRendererAdapter` contract inside `@agenter/terminal-view`, with comments that explain the adapter law, host responsibilities, why desktop currently prefers `ghostty-web`, and why `auto` remains front-end policy.
- [x] 2.2 Migrate the current xterm implementation behind the adapter contract without changing terminal transport or snapshot hydration law.
- [x] 2.3 Add a `ghostty-web` adapter and wire current desktop `auto` resolution to `ghostty-web`.
- [x] 2.4 Replace renderer-private DOM and metric assumptions in `terminal-view` with adapter-owned public viewport facts.

## 3. Theme Integration and Host Migration

- [x] 3.1 Add shared declarative terminal theme and cursor resolution, with at least `default-dark` and `default-light`, and leave adapter-specific room for deeper renderer mappings such as `monokai`.
- [x] 3.2 Migrate terminal-window body and viewport background rendering to consume terminal theme background instead of feature-local gradients.
- [x] 3.3 Update WebUI terminal hosts to consume renderer/theme projection through the shared viewport contract rather than xterm-specific selectors or assumptions.

## 4. Verification and Recovery Hardening

- [x] 4.1 Update unit tests, story/DOM tests, and e2e selectors to rely on public viewport facts instead of xterm-private selectors.
- [x] 4.2 Verify desktop terminal behavior for snapshot hydration, live transport, fit/cover sizing, focus/input, and resize after switching the default desktop resolver to `ghostty-web`.
- [x] 4.3 Document any remaining gaps for future `wterm` integration and ensure code comments preserve the `ghostty-web` / `wterm` / `auto` rationale so the next engineer can resume without reconstructing renderer law from scratch.
