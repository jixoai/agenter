## 1. Alignment / Investigation

- [x] 1.1 Confirm the latest `plans/plan.md` records the `@jixo/reactive-fs` package namespace, the `default` Avatar locked fallback rule, and the current `../openspecui` reactive-fs survey.
- [x] 1.2 Confirm the four delta specs are the implementation contract: `reactive-file-system`, `avatar-prompt-authority`, `prompt-dependency-refresh`, and `release-native-dependency-boundary`.
- [x] 1.3 Confirm before app-code work whether existing non-default Avatars without `AGENTER.mdx` should be backfilled automatically, offered through an explicit repair command, or left untouched.
- [x] 1.4 Confirm before app-code work whether app prompt package resources should remain package-owned dependency nodes or also be mirrored under `~/.agenter/apps/<app-id>/`.
- [x] 1.5 Confirm no task checkbox is updated unless the agent completed and verified that task in the current working context.

## 2. BDD Contract

- [x] 2.1 Add package-boundary tests for `@jixo/reactive-fs`: Given Agenter imports the package When package exports are inspected Then no prompt, Avatar, OpenSpec, daemon, or UI types leak into the package API.
- [x] 2.2 Add reactive-read tests for `@jixo/reactive-fs`: Given a context reads file, directory, exists, and stat values When each dependency changes Then the context emits a refreshed result with the latest filesystem value.
- [x] 2.3 Add missing-path tests for `@jixo/reactive-fs`: Given a context reads a missing file When the file is created after watcher initialization or through polling fallback Then the context observes the new file.
- [x] 2.4 Add watcher-root tests for `@jixo/reactive-fs`: Given dependencies span home, package, and workspace roots When watcher roots are registered Then all roots have inspectable watcher runtime status.
- [x] 2.5 Add default Avatar prompt tests: Given the default Avatar `AGENTER.mdx` has user-edited content When the daemon starts Then startup overwrites it with the canonical default wrapper and reports locked fallback ownership.
- [x] 2.6 Add non-default Avatar prompt tests: Given a non-default Avatar has an existing canonical `AGENTER.mdx` When daemon startup and app assistant initialization run Then the file is not overwritten.
- [x] 2.7 Add builtin prompt materialization tests: Given daemon startup runs When builtin prompts are inspected Then `~/.agenter/builtin/<lang>/` contains managed prompt files and Slot inheritance reads those files.
- [x] 2.8 Add prompt render trace tests: Given a prompt wrapper Slots builtin and app resources When the prompt is rendered Then the result includes rendered text, source identity, dependency nodes, owner kind, freshness identity, and Avatar ownership policy.
- [x] 2.9 Add prompt refresh tests: Given a running session has a prompt dependency graph When one dependency changes Then prompt state is marked dirty and the next safe model boundary rerenders without mutating any in-flight provider request.
- [x] 2.10 Add resource resolution tests: Given Slots use `global:`, `app:`, `npm:`, `file:`, and `$LANG` variables When rendering runs Then dependency nodes contain expanded URIs and resolved file or package asset paths.
- [x] 2.11 Add release boundary tests: Given the Agenter release bundle imports `@jixo/reactive-fs` When bundle specs are inspected Then `@parcel/watcher` remains external and install-time dependency metadata is present.
- [x] 2.12 Add stale-daemon diagnostics tests: Given a daemon was launched from stale code that does not materialize builtin prompt files When prompt inspection runs Then diagnostics identify stale/missing file-backed prompt roots instead of silently trusting memory prompt defaults.

## 3. Implementation

- [x] 3.1 Run `bun run openspec:vision -- commit-check file-backed-prompt-authority --phase apply` before app-code work starts and commit the ready OpenSpec artifacts.
- [x] 3.2 Create the `packages/reactive-fs` workspace package with public name `@jixo/reactive-fs`, typed exports, package metadata, test script, and `@parcel/watcher` runtime dependency metadata.
- [x] 3.3 Port the reusable reactive-fs implementation from `../openspecui/packages/core/src/reactive-fs/` into `@jixo/reactive-fs` without prompt-specific coupling.
- [x] 3.4 Refactor watcher pooling to support a registry of watched roots instead of assuming one project root covers every dependency.
- [x] 3.5 Wire `@jixo/reactive-fs` into app-server prompt rendering so Avatar `AGENTER.mdx`, builtin prompts, package prompts, and file Slots are read through reactive operations when runtime prompt state is rendered.
- [x] 3.6 Extend prompt rendering to return structured dependency evidence: original URI, expanded URI, resolved path, owner kind, read kind, freshness identity, render hash, rendered timestamp, and Avatar ownership policy.
- [x] 3.7 Implement prompt dirty-state handling so dependency changes mark affected sessions stale and rerender only at safe model input/model-call boundaries.
- [x] 3.8 Implement normal Avatar prompt seeding as seed-if-missing only, preserving existing non-default canonical `AGENTER.mdx` files.
- [x] 3.9 Implement default Avatar daemon startup overwrite with the canonical default wrapper and explicit locked fallback ownership metadata.
- [x] 3.10 Preserve daemon startup builtin prompt materialization under `~/.agenter/builtin/<lang>/` and make missing/stale materialization diagnosable.
- [x] 3.11 Add or extend prompt inspection surfaces so operators can see canonical Avatar prompt path, ownership policy, render identity, dependency graph, watcher status, and stale/current state.
- [x] 3.12 Update release bundle metadata so bundled runtime entries keep `@parcel/watcher` external and include runtime dependency metadata needed for installation.
- [x] 3.13 Add concise intent comments at critical effect points: default Avatar overwrite, non-default overwrite refusal, dependency dirty marking, and native watcher externalization.
- [ ] 3.14 Implement any approved non-default Avatar backfill or repair helper only after task 1.3 is resolved.
- [x] 3.15 Update only current-context completed task checkboxes and commit them with matching implementation and BDD evidence.

## 4. Verification

- [x] 4.1 Run `bun test` or package-specific tests for `@jixo/reactive-fs`.
- [x] 4.2 Run targeted app-server tests covering Avatar prompt seeding, default prompt overwrite, prompt dependency trace, and prompt refresh at model boundaries.
- [x] 4.3 Run release boundary tests covering `@parcel/watcher` externalization and package metadata.
- [x] 4.4 Run `bun run --filter '@jixo/reactive-fs' typecheck` after the package exists.
- [x] 4.5 Run targeted `@agenter/app-server` typecheck/tests affected by prompt rendering.
- [x] 4.6 Run `bun run openspec:vision -- validate file-backed-prompt-authority`.
- [ ] 4.7 Run `bun run openspec:vision -- commit-check file-backed-prompt-authority --phase self-review` before writing final review evidence.

## 5. Self-Review Loop

- [ ] 5.1 Generate `review/self-review.md` comparing implementation against `plans/plan.md`, all four delta specs, and current task evidence.
- [ ] 5.2 Generate `review/self-review.html` as the structured evidence presentation for prompt authority, watcher status, and release boundary results.
- [ ] 5.3 If self-review updates OpenSpec artifacts or reopens tasks, commit those artifact changes before the next apply loop.
- [ ] 5.4 If review enters a real loop, run `bun run openspec:vision -- review-state file-backed-prompt-authority` to persist iteration state.
- [ ] 5.5 If review cannot exit normally, run `bun run openspec:vision -- handoff file-backed-prompt-authority` and commit the handoff evidence before returning to user discussion.
- [ ] 5.6 If review exits normally, run `openspec archive file-backed-prompt-authority` and commit the archive result.
- [ ] 5.7 Run `bun run openspec:vision -- check file-backed-prompt-authority` and decide whether to exit or return to `research-plan` with a backed-up plan revision.
