## 1. Attention Context Slot Model

- [x] 1.1 Add immutable `template` plus mutable `slots` support to `attention-system` state and keep `content` as the derived render result.
- [x] 1.2 Extend attention commits with slot targeting, default `target=default`, and readonly/unknown-slot validation.
- [x] 1.3 Add runtime-internal readonly slot update helpers and focused tests for slot rendering, targeting, and validation.

## 2. Runtime Skill System Surface

- [x] 2.1 Introduce a canonical runtime skill context and a dedicated runtime skill service that refreshes the rendered skill snapshot from file-backed truths.
- [x] 2.2 Add the public `skill` runtime-local CLI/API surface for list/search/info/upsert/remove/refresh and move reusable read logic behind internal SDK helpers.
- [x] 2.3 Publish skill add/remove/update events as attention reminders while keeping built-in skills read-only.

## 3. Bootstrap and Legacy Cleanup

- [x] 3.1 Remove the legacy `skillsList -> AGENTER_SYSTEM -> systemPrompt` assembly path and switch bootstrap publication to the attention-backed skill context snapshot.
- [x] 3.2 Update prompt guidance, runtime skill progressive-disclosure text, and runtime shell discovery so the public contract teaches `skill` instead of `ccski`.
- [x] 3.3 Delete obsolete code paths, adapters, and tests that preserve the old prompt-bound skill behavior.

## 4. Verification

- [x] 4.1 Update and pass targeted attention-system, runtime skill, runtime CLI, and prompt assembly tests for the new contracts.
- [x] 4.2 Update durable specs or package-level SPEC references touched by the breaking cleanup and confirm the OpenSpec tasks are complete.
- [x] 4.3 Reconcile real `ai_call.requestBody` evidence with the bootstrap contract by restoring `summary -> context -> items` ordering and updating the durable bootstrap spec.

## 5. Live Skill Watch / Config

- [x] 5.1 Extend runtime skill truth with sibling `ccski.config.json`, parsed `files[]`, and resolved watch-target calculation without turning `skill` into an arbitrary file browser.
- [x] 5.2 Add controlled skill live-sync topology: shallow root/skill watchers, declared-file watchers, and subtree polling fallback for recursive `**` targets.
- [x] 5.3 Flush watcher-detected changes at the next model input collection boundary, with an idle debounce fallback that still publishes aggregated attention reminders per changed skill.
- [x] 5.4 Add `skill get-config` / `skill set-config`, including built-in read support and built-in write enforcement through existing workspace `rw` authority only.
- [x] 5.5 Update runtime specs/docs/tests for watcher/config behavior and rerun the targeted verification suite.
