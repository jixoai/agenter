## 1. Alignment / Investigation

- [x] 1.1 Confirm `plans/plan.md`, `specs/web-heartbeat-view/spec.md`, `specs/web-heartbeat-view-example/spec.md`, and `specs/workspace-runtime-shell/spec.md` still agree on package ownership, grouped Heartbeat truth, `readonly | configable` modes, mobile-first example acceptance, and deferred Studio migration; completion condition: mismatches are either fixed in OpenSpec or recorded as explicit follow-up questions.
- [x] 1.2 Treat Avatar directory semantics as resolved by user correction: global Avatar catalog rows are HeartbeatPage targets regardless of running state, and running only affects live-push status; completion condition: implementation plans do not reintroduce a running-session gate for opening HeartbeatPage.
- [x] 1.3 Treat `AgenterHeartbeatConnection` as the confirmed first name for the `认知链接` package boundary and use existing `@agenter/client-sdk` transport/store first; completion condition: public exports and example adapter use that naming unless implementation proves a narrower name is required.
- [x] 1.4 Treat Studio migration as explicitly deferred until after `@agenter/web-heartbeat-view:example` acceptance; completion condition: first-phase implementation does not rebind Studio, and follow-up migration risk is recorded.
- [x] 1.5 Inspect current `packages/web-chat-view` package/example scripts, Svelte entrypoints, Framework7 setup, Storybook/Vitest setup, and package `SPEC.md` conventions; completion condition: implementation checklist names the exact files to mirror or intentionally diverge from.
- [x] 1.6 Inspect current Studio Heartbeat files, including parser/materialization helpers, statusbar, tool block, part content, route adapter inputs, and known scroll/render/performance issues; completion condition: every file to copy, migrate, wrap, or leave behind is listed before edits begin.
- [x] 1.7 Inspect and document the existing Studio data path: Avatar catalog `runtimeId`, deterministic `resolveAvatarRuntimeId` / `resolveAvatarSessionId`, `createSession({ autoStart:false })`, and `runtime.heartbeatGroupsPage({ sessionId })`; completion condition: implementation uses this existing path and does not invent a new backend endpoint.
- [x] 1.8 Treat backend endpoint changes as out of scope for first apply; completion condition: if implementation appears to require adding or reshaping a backend endpoint, stop and discuss with the user before adding tasks or code.
- [x] 1.9 Treat `readonly` as frontend presentation cleanup rather than backend isolation; completion condition: readonly hides compact/config actions, while authentication/authorization remains the real interface isolation layer and `createSession({ autoStart:false })` remains allowed for Heartbeat DB reads.
- [x] 1.10 Run `bun run openspec:vision -- validate add-web-heartbeat-view`; completion condition: validation passes before implementation starts.
- [x] 1.11 Run `bun run openspec:vision -- commit-check add-web-heartbeat-view --phase apply` before app-code work starts and create the OpenSpec artifact commit when the check permits it; completion condition: app-code work starts only after the ready OpenSpec artifact commit exists or a blocker is recorded.
- [x] 1.12 Confirm each checkbox in this file will only be checked by the agent that completed and verified that task in the current working context; completion condition: later agents do not bulk-check inherited work without rerunning its verification.

## 2. BDD Contract

- [x] 2.1 Add package unit tests for Heartbeat parser/materialization behavior covering grouped `before-call`, `call`, `compact`, `before-call-pending`, folded request facts, compact prompt/result merge, running tool params, assistant thinking/text order, JSON/config facts, and clipboard/source text; completion condition: tests fail before migration or are explicitly marked as current-pass regression locks.
- [x] 2.2 Add package unit tests for cached grouped-resource state covering cold loading, loaded empty, loaded with data, warm refreshing with preserved rows, refresh error with preserved rows, and top load-older in-flight state; completion condition: state transitions are asserted without inferring loading from `data.length`.
- [x] 2.3 Add package Svelte/DOM contract stories and tests for `HeartbeatView` in `readonly` mode; completion condition: grouped stream renders and compact/config write actions are not executable.
- [x] 2.4 Add package Svelte/DOM contract stories and tests for `HeartbeatView` in `configable` mode; completion condition: bottom statusbar compact/config actions appear only when handlers/authority exist, and missing authority disables or hides only the affected action.
- [x] 2.5 Add package Svelte/DOM contract stories and tests for structured rows; completion condition: reasoning, markdown/text, JSON/config, tool running/completed, compact card, and load-older affordance render through package-owned components.
- [x] 2.6 Add a dependency-boundary test or static check that `@agenter/web-heartbeat-view` does not import from `apps/studio`; completion condition: the check fails on any package import path that crosses into Studio.
- [x] 2.7 Add example route tests for mobile-first navigation from connection/root directory to Avatar tap to HeartbeatPage; completion condition: iPhone 14-class viewport can complete the path without search or desktop-only shortcuts.
- [x] 2.8 Add example route tests for connection failure, unauthenticated/unavailable target, non-running Avatar with persisted or loaded-empty DB Heartbeat state, no-live-push state, and direct HeartbeatPage URL reload; completion condition: each edge renders an explicit state rather than a stale blank list or unavailable target.
- [x] 2.9 Add package scroll/render stability tests or browser assertions for the Studio-baseline Heartbeat surface covering live append, warm refresh, expand/collapse, compact card detail toggle, and older-page prepend; completion condition: tests detect jitter, unstable remounting, or scroll jumps observable from the route surface.
- [x] 2.10 Add example route tests for `readonly` and `configable` launch/mode selection; completion condition: readonly cannot mutate, configable uses formal adapter compact/config callbacks.
- [x] 2.11 Add package/example boundary tests proving first-phase code does not require Studio runtime imports or Studio route state; completion condition: the package and example remain runnable without rebinding Studio.
- [x] 2.12 Add BDD names using `Feature:` / `Scenario: Given ... When ... Then ...` for new Vitest/DOM/E2E coverage; completion condition: new tests follow repository BDD naming discipline.

## 3. Implementation

- [x] 3.1 Scaffold `packages/web-heartbeat-view` with Svelte 5, Framework7-compatible peer/runtime dependencies, package exports, typecheck/test/storybook scripts matching repo conventions, and a concise package `SPEC.md`; completion condition: package is discoverable by pnpm workspace filters and exports typed Svelte entrypoints.
- [x] 3.2 Copy and reorganize Studio Heartbeat parser/materialization helpers inside `@agenter/web-heartbeat-view` as package-owned code, using Studio as the first implementation baseline; completion condition: package parser tests pass and no package file imports Studio.
- [x] 3.3 Copy and reorganize the minimal AI-elements-style Heartbeat primitives inside the package, informed by current Studio components and svelte-ai-elements patterns; completion condition: reasoning, tool, context, action, loader, markdown/text, and JSON surfaces render without Studio dependencies.
- [x] 3.4 Implement `HeartbeatView` as the host-neutral presentational surface over grouped Heartbeat resource state, model calls, scheduler state, attention/delivery summaries, identity presentation, load-older callback, and capability mode; completion condition: package DOM contract tests pass for loaded/loading/refreshing/error states.
- [x] 3.5 Implement the bottom statusbar and capability action model for `readonly` and `configable`; completion condition: compact/config actions are mode-gated and call formal callbacks rather than transcript commands.
- [x] 3.6 Implement optional Framework7-compatible `HeartbeatPage` shell around `HeartbeatView`; completion condition: Framework7 hosts can mount a page-level Heartbeat route without rewriting package internals.
- [x] 3.7 Implement exported host-neutral connection types, including `HeartbeatCapabilityMode` and the provisional `AgenterHeartbeatConnection` boundary; completion condition: types compile without `any`, `as any`, or Studio-specific state.
- [x] 3.8 Scaffold `packages/web-heartbeat-view/example` as a runnable Framework7 Svelte example app; completion condition: `pnpm`/`bun` workspace scripts can start the example dev server independently.
- [x] 3.9 Implement the example Agenter connection adapter over existing `@agenter/client-sdk`; completion condition: adapter hydrates connection state, global Avatar catalog, deterministic Avatar runtime/session id, creates/reuses session metadata with `autoStart:false` when needed, hydrates grouped Heartbeat state through existing `runtime.heartbeatGroupsPage({ sessionId })`, reads optional runtime live-push state, model-call context when available, scheduler state when available, attention/delivery summaries when available, load older, manual compact, and next-call config paths without backend endpoint changes.
- [x] 3.10 Implement the example Avatar directory with Framework7 `Page`, `Navbar`, grouped `List`, Avatar rows, live-push status, and connection status, without first-phase search; completion condition: mobile route test can select any Avatar and navigate to HeartbeatPage.
- [x] 3.11 Implement the example `HeartbeatPage` route with reload-safe route params, Avatar identity, optional runtime/session identity, package `HeartbeatView` or `HeartbeatPage`, load older, live refresh when available, no-live-push status, and mode selection; completion condition: direct route test hydrates or shows explicit connection-required state.
- [x] 3.12 Fix the known Studio-baseline Heartbeat scroll/render/performance issues during package migration; completion condition: row identity, expand/collapse, older-page prepend, live append, and warm refresh are stable under the tests from task 2.9.
- [x] 3.13 Record a follow-up Studio migration note after example acceptance rather than rebinding Studio in first-phase apply; completion condition: package boundary stays future-compatible and no Studio files are modified solely for migration.
- [x] 3.14 Add concise intent comments at critical effect points: grouped-resource truth boundary, Avatar DB target versus live-push state, mode-gated write authority, connection adapter boundary, and deferred Studio migration boundary; completion condition: comments explain why effects are constrained without narrating obvious assignments.
- [x] 3.15 Update only task checkboxes completed and verified in the current working context, and commit task-progress updates with matching implementation/BDD evidence; completion condition: each commit has code, tests, and task state aligned.

## 4. Verification

- [x] 4.1 Run `bun run --filter '@agenter/web-heartbeat-view' typecheck`; completion condition: command passes with no type-safety suppressions added for first-party code.
- [x] 4.2 Run `bun run --filter '@agenter/web-heartbeat-view' test`; completion condition: package unit and DOM contract tests pass.
- [x] 4.3 Run the example typecheck/test scripts added for `packages/web-heartbeat-view/example`; completion condition: example route/unit coverage passes.
- [x] 4.4 Confirm no first-phase Studio migration was applied; completion condition: only intentional package/example changes are present, and any touched Studio files are justified by non-migration needs.
- [x] 4.5 Run repository-level typecheck/test commands required by the touched packages; completion condition: no unrelated failure is hidden, and any pre-existing unrelated failure is documented with evidence.
- [x] 4.6 Run a static search for forbidden package dependencies, backend endpoint changes, and type-safety escapes, including Studio imports from package code and new `any`/`as any`/`@ts-nocheck`; completion condition: no new violation remains and no backend route/kernel API shape was changed without a recorded user decision.
- [x] 4.7 Start the standalone example on a fresh available local port and capture route-level mobile evidence for an iPhone 14-class viewport; completion condition: screenshots or browser evidence cover connection/directory, Avatar selection, HeartbeatPage stream, load older, and bottom statusbar mode behavior.
- [x] 4.8 Capture route-level desktop evidence for the same example flow; completion condition: desktop extends the mobile path and does not require a desktop-only shortcut for core capabilities.
- [x] 4.9 Record deferred Studio migration as a follow-up risk after example acceptance; completion condition: self-review does not claim Studio parity as completed in first phase.
- [x] 4.10 Run `bun run openspec:vision -- validate add-web-heartbeat-view`; completion condition: change validates after implementation and task updates.
- [x] 4.11 Run `bun run openspec:vision -- commit-check add-web-heartbeat-view --phase self-review` before writing final review evidence; completion condition: self-review starts only after required implementation evidence is present.
- [x] 4.12 Keep the standalone example server running for final user acceptance and report the concrete URL; completion condition: user receives a live URL that opens the implemented example.

## 5. Self-Review Loop

- [x] 5.1 Generate `review/self-review.md` comparing implementation against `plans/plan.md`, every spec requirement, and completed task evidence; completion condition: review lists pass/fail/blocked status for package, example, deferred Studio migration, and live URL acceptance.
- [x] 5.2 Generate `review/self-review.html` as the structured screenshot/interaction evidence presentation; completion condition: it references current mobile and desktop evidence rather than stale screenshots.
- [x] 5.3 If self-review finds spec drift, missing behavior, or unverified assumptions, reopen the relevant tasks and update OpenSpec artifacts before another apply loop; completion condition: reopened work is committed before more app-code edits.
- [x] 5.4 If review enters a real loop, run `bun run openspec:vision -- review-state add-web-heartbeat-view`; completion condition: recurrence/iteration state is persisted before continuing.
- [x] 5.5 Confirm abnormal-exit handoff is not required because review exited normally; completion condition: no handoff artifact is needed for this milestone, and any future abnormal exit must still run `bun run openspec:vision -- handoff add-web-heartbeat-view`.
- [x] 5.6 If review exits normally, sync durable package or project `SPEC.md` updates required by long-term behavior before archive; completion condition: durable law is not left only inside `openspec/changes/*`.
- [ ] 5.7 Archive `add-web-heartbeat-view` only after the user explicitly accepts the active change state; completion condition: archive is performed from the active change and committed as a dedicated final docs/spec commit.
- [ ] 5.8 Run `bun run openspec:vision -- check add-web-heartbeat-view` before any future archive; completion condition: the workflow exits cleanly or returns to an active planning/apply loop.

## 6. User Acceptance Polish

- [x] 6.1 Record the latest acceptance feedback in `review/` and preserve user-authored style adjustments as accepted state; completion condition: implementation does not revert unrelated CSS or layout edits made outside this pass.
- [x] 6.2 Hide per-card `Compact / Detailed` layout controls when compact and detailed renderings have no meaningful behavioral difference; completion condition: plain markdown/text rows do not show the segmented control, while tool/reasoning/compact-fact rows still expose it.
- [x] 6.3 Replace visible tool-call status text such as `DONE` with color-coded icons and accessible labels; completion condition: tool summaries expose state through icon/color without rendering uppercase status words.
- [x] 6.4 Replace the bottom Compact action icon with a non-sparkle icon that reads as memory compression/archival; completion condition: the bottom toolbar keeps official Framework7 `Link iconOnly` controls.
- [x] 6.5 Restore Framework7 Modal Sheet entrance animation for the config sheet; completion condition: the sheet is mounted closed first and opened on the next tick rather than appearing already-open.
- [x] 6.6 Rework the config sheet body to follow official Framework7 modal sheet/list form structure, including `List`/`ListInput` rows and official `Toggle` for Thinking; completion condition: custom checkbox styling is removed from the config form.
- [x] 6.7 Distinguish user and assistant message rows visually, placing user-message identity/avatar on the right; completion condition: Heartbeat entries include role-aware alignment without changing persisted Heartbeat facts.

## 7. Context Usage Polish

- [x] 7.1 Record the latest acceptance feedback that most behavior passed and user-authored style changes are accepted; completion condition: review evidence preserves the new context-usage request without reverting unrelated style edits.
- [x] 7.2 Replace the bottom Compact toolbar button with a context-usage display control; completion condition: configable bottom toolbar shows a compact context-usage label like `31.3%` plus a circular indicator instead of a first-level compact icon.
- [x] 7.3 Move manual Compact into the context-usage Modal Sheet; completion condition: compact remains reachable from the Sheet as an icon+text action using the `Shredder` icon and still goes through the official confirm dialog before invoking the adapter callback.
- [x] 7.4 Implement the context-usage Modal Sheet; completion condition: the Sheet shows percentage, used/max context tokens, input/output token rows, and a bottom model/config summary without rendering cost fields.
- [x] 7.5 Remove context-usage text from the top subnavbar title; completion condition: subnavbar keeps runtime/live/group/attention status but no longer repeats token usage.
- [x] 7.6 Add BDD coverage and mobile evidence for the context-usage control and Sheet; completion condition: tests and agent-browser evidence prove no horizontal overflow, official Sheet animation, and the moved compact action.

## 8. Context Usage Style / List Polish

- [x] 8.1 Record the latest acceptance feedback about balanced toolbar actions, progress-color ring semantics, shared Modal Sheet styling, and Context usage ListView structure; completion condition: review evidence names these four user-visible polish requirements without changing backend scope.
- [x] 8.2 Balance the bottom Toolbar actions using official Framework7 Toolbar + Link controls; completion condition: Context usage and Config occupy equal action slots instead of the Context usage control taking most toolbar width.
- [x] 8.3 Make the bottom context ring a progress indicator; completion condition: the ring has a muted track and a `color-mix(... oklch|oklab ...)` progress color path from green through orange to red based on context usage progress.
- [x] 8.4 Generalize the accepted Modal Sheet toolbar/title/content styling across Heartbeat Modal Sheets; completion condition: Config and Context usage sheets share the same base sheet classes and preserve the previously accepted toolbar/title styling.
- [x] 8.5 Rebuild Context usage sheet content with Framework7 List/ListItem structure; completion condition: summary, token rows, compact action, and model/config facts are rendered as official ListView rows and no cost field is rendered.
- [x] 8.6 Update BDD coverage, typecheck/test, OpenSpec validate/check, and mobile agent-browser evidence for this polish pass; completion condition: tests pass and final evidence confirms no horizontal overflow and the updated Context usage sheet.

## 9. Context Usage Official Components

- [x] 9.1 Record the latest acceptance feedback requesting official Framework7 `Progressbar` for Context usage and `ListButton` for Compact; completion condition: review evidence names both component requirements.
- [x] 9.2 Replace the Context usage Sheet's internal progress display with Framework7 `Progressbar`; completion condition: the Sheet renders `.progressbar` with the correct `data-progress` while the bottom Toolbar ring remains the compact trigger indicator.
- [x] 9.3 Replace the Context usage Compact action row with Framework7 `ListButton`; completion condition: Compact is rendered through `.list-button` inside an official `List` and still invokes the existing confirm dialog before the compact callback.
- [x] 9.4 Update BDD, typecheck/test, OpenSpec validate/check, and mobile agent-browser evidence; completion condition: verification passes and screenshots show the official progressbar/list button structure.
