## 1. Alignment / Investigation

- [x] 1.1 Re-read `plans/plan.md` and `specs/cli-shell-product/spec.md` before app-code work, and confirm the latest user decisions are represented: `/avatar` is in scope, legacy compatibility is out of scope, and New Terminal still asks for Avatar selection.
- [x] 1.2 Inspect the current Shell navigation, bootstrap, Room composer command, and grant APIs before implementation; record any missing API as a platform task instead of adding Shell-local state.
- [x] 1.3 Confirm no destructive legacy cleanup is being performed in this apply loop; unsupported legacy bindings may be omitted or marked unavailable, but existing durable resources must not be deleted without a separate explicit approval.
- [x] 1.4 Run `bun run openspec:vision -- commit-check streamline-shell-entry-terminal-selection --phase apply` and commit ready OpenSpec artifacts before touching app-code.

## 2. BDD Contract

- [x] 2.1 Add a behavior test: Scenario: Given an existing canonical Shell-bound Terminal/Room row When the operator confirms it Then navigation completes directly without entering the Avatar step.
- [x] 2.2 Add a behavior test: Scenario: Given the New Terminal row and no explicit `--avatar` When the operator confirms it Then navigation still opens Avatar selection before completion.
- [x] 2.3 Add a behavior test: Scenario: Given an existing Terminal row When it is selected Then bootstrap does not issue a new terminal grant or room grant solely because of entry.
- [x] 2.4 Add a behavior test: Scenario: Given room participants include the current superadmin and two Avatars When Select Terminal rows render Then the people field shows the two Avatars as mentions and excludes superadmin.
- [x] 2.5 Add a behavior test: Scenario: Given a Shell-bound Terminal has key, status, title, path, and people fields When the Select Terminal panel renders Then those fields remain distinct projection roles with distinct styles.
- [x] 2.6 Add a behavior test: Scenario: Given an unsupported legacy resource key or incomplete Terminal/Room binding When Select Terminal is built Then it is not auto-repaired, migrated, or used for Avatar inference.
- [x] 2.7 Add a behavior test: Scenario: Given Room composer focus When `/avatar` is invoked Then an OpenTUI command panel opens in the composer command area and Escape returns focus to normal composer editing.
- [x] 2.8 Add a behavior test: Scenario: Given the `/avatar` panel adds an Avatar When the operator confirms Room and Terminal permissions Then MessageSystem and TerminalSystem grant APIs receive the selected existing grant roles.
- [x] 2.9 Add a behavior test: Scenario: Given the `/avatar` panel removes an Avatar When the operator confirms removal Then only the active Shell binding's Room/Terminal grants are revoked and the Avatar catalog/runtime records remain intact.
- [x] 2.10 Add a behavior test: Scenario: Given the `/avatar` panel updates permissions When the operator changes roles Then no Shell-local permission bitset is persisted.
- [x] 2.11 Confirm each task checkbox is updated only by the agent that completed and verified that exact task in the current working context.

## 3. Implementation

- [x] 3.1 Add or refactor a Shell binding projection module that joins canonical Shell Terminal entries with their matching Room entries by `appId=shell` and normalized `resourceKey`, without moving Terminal or Room truth into Shell-local state.
- [x] 3.2 Extend the navigation store/model contract to read bound Rooms, room participants/grants, current auth scope, and Avatar catalog data needed by Select Terminal and `/avatar`.
- [x] 3.3 Replace the existing flattened shell row label with structured row fields for resource key, lifecycle/status, title, detail path/id, and people mentions.
- [x] 3.4 Update the OpenTUI navigation renderer to use distinct style/color roles for structured Select Terminal fields and keep selected-row and truncation behavior stable.
- [x] 3.5 Change navigation confirmation so existing canonical Terminal rows complete immediately, while the New Terminal row still transitions to Avatar selection when no explicit Avatar is supplied.
- [x] 3.6 Split bootstrap/attach behavior so existing-row direct entry does not issue new grants as an entry side effect; keep new binding bootstrap and explicit Avatar flows on the existing grant-owning APIs.
- [x] 3.7 Remove hidden legacy compatibility from selection: unsupported legacy resource keys or incomplete Terminal/Room bindings must not trigger migration, repair, or Avatar inference during entry.
- [x] 3.8 Add concise intent comments at the critical effect points where entry refuses hidden Avatar grant mutation and where legacy compatibility is intentionally not applied.
- [x] 3.9 Implement the `/avatar` Room composer command as an OpenTUI panel-style surface using existing Room composer command mechanics rather than a separate entry wizard.
- [x] 3.10 Implement Avatar add in the `/avatar` panel by selecting from Avatar catalog data and issuing MessageSystem room grants plus TerminalSystem terminal grants with explicit roles.
- [x] 3.11 Implement Avatar removal in the `/avatar` panel by revoking only the selected Avatar's grants for the active Shell binding's Room and Terminal.
- [x] 3.12 Implement Avatar permission editing in the `/avatar` panel by mapping Room roles to `admin/member/readonly` and Terminal roles to `admin/writer/guard/readonly`, with no Shell-local permission persistence.
- [x] 3.13 Update current-context task checkboxes only after the matching BDD, implementation, and verification evidence exists, and commit task progress together with the matching code evidence.

## 4. Verification

- [x] 4.1 Run the focused Shell navigation/model tests that cover direct existing entry, New Terminal Avatar selection, row projection, people mentions, and unsupported legacy binding behavior.
- [x] 4.2 Run the focused Shell Room composer tests that cover `/avatar` panel open/close, add, remove, and permission editing.
- [x] 4.3 Run `bun run --filter 'agenter-app-shell' test` if the focused tests do not already exercise the full Shell package surface.
- [x] 4.4 Run `bun run --filter 'agenter-app-shell' typecheck`.
- [x] 4.5 Run `bun run openspec:vision -- validate streamline-shell-entry-terminal-selection`.
- [x] 4.6 Run `bun run openspec:vision -- commit-check streamline-shell-entry-terminal-selection --phase self-review` before writing review evidence.

## 5. Self-Review Loop

- [x] 5.1 Generate `review/self-review.md` comparing the final implementation against `plans/plan.md`, the specs, and the three clarified user decisions.
- [x] 5.2 Generate `review/self-review.html` or an equivalent structured review evidence artifact if the vision workflow requires an HTML evidence surface for this change.
- [ ] 5.3 If self-review reopens tasks or changes specs/tasks, commit those OpenSpec artifact updates before the next apply loop.
- [ ] 5.4 If the review enters a real loop, run `bun run openspec:vision -- review-state streamline-shell-entry-terminal-selection` to persist iteration and recurrence state.
- [ ] 5.5 If the review cannot exit normally, run `bun run openspec:vision -- handoff streamline-shell-entry-terminal-selection` and commit the handoff evidence before returning to user discussion.
- [ ] 5.6 If the review exits normally, run `openspec archive streamline-shell-entry-terminal-selection` and commit the archive result.
- [ ] 5.7 Run `bun run openspec:vision -- check streamline-shell-entry-terminal-selection` and decide whether to exit or return to `research-plan` with a backed-up plan revision.
