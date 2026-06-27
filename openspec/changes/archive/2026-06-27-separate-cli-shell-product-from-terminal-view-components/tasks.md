> Superseded note:
> Treat these checkboxes as historical record and evidence only.
> This task list is built on the older `terminal-1` / `terminal-2` cli-shell architecture and must not be resumed directly after `realign-cli-shell-with-core-system-boundaries`.

> These checkboxes are implementation-time obligations for applying this corrective supplement. Current dirty-workspace experiments, partial code changes, or `.chat` probes may inform the plan, but they do not count as completion truth until the repaired change is actually applied and re-verified.

## 0. Terminology And Boundaries

- [x] 0.1 Remove the old ambiguous host term from durable docs, tests, and role-facing implementation seams; use `web-terminal-view` for the Web component, `shell-terminal-view` for the native terminal component, and `cli-shell` for the app without forcing an immediate package rename.
- [x] 0.2 Refactor the terminal-view capability around one canonical terminal substrate with derived projection/composition consumed by two platform component roles rather than by one ambiguous host term.
- [x] 0.3 Record the durable split between backend terminal truth, component projection, and app composition so later changes do not collapse those layers again.
- [x] 0.4 Link this change explicitly to archived `add-cli-shell-app` as a corrective supplement that reopens architecture-dependent acceptance obligations rather than redefining the app effect from scratch.
- [x] 0.5 Preserve inherited complete current-worktree laws from `promote-ghostty-native-cli-shell` and `promote-ghostty-native-terminal-backend`; do not reopen `--backend=<name>`, one-line markdown bottom projection, or backend-projection completeness semantics inside this change.

## 1. Runtime-owned Resource Binding Truth

- [x] 1.1 Ensure runtime-owned terminal and room bindings derive grant actor truth from the created or reused session runtime actor rather than from global avatar catalog metadata.
- [x] 1.2 Ensure runtime-owned terminal and room focus flows land through session-owned runtime APIs such as `focusTerminals` and `focusMessageChannels` rather than unrelated global-only focus semantics.
- [x] 1.3 Return or preserve session actor truth in bootstrap/binding outputs wherever the app later needs delegation attribution, unread projection, managed-mode state, or reconnect behavior.
- [x] 1.4 Add regression coverage proving cli-shell binding still works when avatar catalog principal and session runtime principal differ on a real daemon.
- [x] 1.5 Keep `shell-1` as the durable app session key while deriving two distinct terminal binding resource keys for terminal-1 and terminal-2, so lookup and reconnect cannot collapse the two backend terminal roles back into one resource identity.
- [x] 1.6 Prove the existing generic binding contract is sufficient for cli-shell dual-terminal identity through derived resource keys alone; do not extend platform binding metadata with a cli-shell-specific terminal-role field unless derived keys fail in code evidence.

## 2. Backend Terminal Truth

- [x] 2.1 Ensure backend terminal truth drives render truth, durable terminal change-log truth, and LoopBus terminal observation from one source.
- [x] 2.2 Add runtime contracts for same-terminal shared viewport truth, synchronized visible input results, and explicit geometry-authority truth.
- [x] 2.3 Add terminal transport or control-plane synchronization for shared viewport mutations without weakening bytes-first live input.
- [x] 2.3.1 Ensure pointer, wheel, and scrollbar-driven viewport mutations from native or Web projections still travel through the same backend-authoritative viewport-mutation path.
- [x] 2.4 Preserve projection-only local presentation scaling so Web hosts can fit or cover a shared terminal without silently rewriting backend rows and columns.
- [x] 2.5 Make the viewport mutation echo path explicit in implementation evidence: attachment request -> backend apply -> authoritative republish, with no client-owned viewport ack truth.
- [x] 2.6 Make attachment resize role explicit in runtime/control-plane evidence: geometry-authoritative versus projection-only, with no last-resizer-wins fallback.
- [x] 2.6.1 Extend the shared transport/control-plane attachment contract beyond `geometryRole` so backend truth can arbitrate multiple frontend attachments with optional explicit `geometry-order` plus stable attachment identity.
- [x] 2.6.2 Persist attachment creation order and renewable liveness/lease facts in backend control-plane, and resolve the active geometry authority there instead of inside one app-local Web host helper.
- [x] 2.6.3 Expose backend-resolved geometry authority winner/losers through evidence or inspection so native and Web acceptance can prove the same backend fact.
- [x] 2.6.4 Ensure shared transport acknowledgement or an equivalent backend inspection seam returns enough geometry-authority facts for clients and acceptance to observe the resolved winner without timing inference.
- [x] 2.6.5 Update terminal transport client/session handshake so protocol roundtrips preserve `geometry-order` input and backend-resolved authority facts such as stable attachment identity and effective resize role.
- [x] 2.6.6 Add regression coverage for explicit-order win, attach-order fallback, winner disconnect reevaluation, and resize rejection from a non-winning authority-capable attachment.
- [x] 2.7 Ensure any visible terminal scrollbar remains a backend-viewport projection rather than a host-local fake scroll owner, even when rendered through an OpenTUI primitive.
- [x] 2.8 Record the durable transport law precisely: canonical backend-to-view synchronization uses backend screen/snapshot/viewport truth, while raw ANSI or VT bytes remain edge adapters rather than the multi-view replication substrate.
- [x] 2.8.4 Remove client-selected viewport from `pullFrame`; frame pulls now consume backend-current viewport truth only, while viewport changes remain explicit `viewportDelta` / `viewportTarget` mutations.
- [x] 2.8.1 Introduce a distinct backend-authored composed runtime for terminal-2 final app truth; keep projection runtime semantics narrow as source-terminal passthrough rather than teaching it to invent accepted app chrome.
- [x] 2.8.2 Make control-plane runtime selection explicit for terminal-2 composition so the final app surface can exist without a fake PTY command, an empty-command bypass, or another disguised managed-shell path.
- [x] 2.8.3 Reuse the existing generic `TerminalRuntime.onSnapshot(...)` / `onStatus(...)` publication seam for terminal-2 composition so live transport, `readGlobalTerminal(...)`, session-runtime terminal observation, and LoopBus continue to consume one standard terminal truth path.

## 3. Terminal-View Component Family

- [x] 3.1 Implement `web-terminal-view` as the reusable Web projection component rather than a WebUI-only or debugging-only surface.
- [x] 3.2 Make `shell-terminal-view` explicit as the native terminal projection role used by `cli-shell`, keeping the contract/component role explicit even if the first repaired implementation stays package-local to `packages/cli-shell`.
- [x] 3.3 Ensure both components remain pure projections of backend terminal truth and do not construct a second authoritative terminal state machine.
- [x] 3.4 Ensure `shell-terminal-view` preserves one continuous renderer surface instead of splitting the same terminal into a colorized live strip and a plain-text historical mirror.
- [x] 3.5 Ensure `shell-terminal-view` keeps backend terminal rows out of host text-flow re-layout; native host composition may use OpenTUI boxes or other chrome primitives, but the shell body itself must remain cell-locked.
- [x] 3.6 Ensure `shell-terminal-view` decodes backend-authored terminal-2 final app truth instead of relying on native-host-local bottom/dialogue chrome that other terminal-2 attachments cannot observe.

## 4. Cli-shell App

- [x] 4.1 Refactor `cli-shell` to compose one explicit `shell-terminal-view` plus one one-line bottom extension as the shell-first app surface, without requiring a premature standalone package split.
- [x] 4.2 Keep the bottom extension orthogonal to shell ownership while still wiring explicit app actions such as buttons, Button clicks, shortcuts, and transcript entry through native interaction paths with no overlay-only fake interaction state.
- [x] 4.2.1 Ensure final native `cli-shell` app affordances are backed by OpenTUI focusable/clickable primitives or another explicitly named host primitive rather than by transparent overlay hotspot layers or plain-text mouse handlers.
- [x] 4.3 Bind backend terminal geometry to the native shell window minus reserved app rows, and keep other same-terminal attachments projection-only unless geometry authority changes explicitly.
- [x] 4.3.1 If `cli-shell --web` retains claim/release UX endpoints, make them adapters over backend-resolved geometry authority only; they must not remain the final ownership law.
- [x] 4.3.2 Ensure any surviving Web-host geometry-claim helper updates backend attachment participation facts rather than defining final ownership in page-local state.
- [x] 4.4 Surface Avatar-started readiness only when LoopBus terminal observation is active for the attached terminal.
- [x] 4.5 Keep optional transcript chrome as explicit extension chrome rather than reusing bottom as a multi-row transcript surface.
- [x] 4.6 Bind visible cursor ownership to explicit native focus ownership: focused `shell-terminal-view` owns the backend terminal cursor, while focused transcript or app input boxes own the visible app cursor.
- [x] 4.7 Keep transcript chrome open after successful send and clear only the draft unless the user explicitly closes or exits that mode.
- [x] 4.8 Ensure cli-shell bootstrap, native host, and `--web` host all expose the dual-terminal law explicitly: terminal-1 for shell authority and observation, terminal-2 for visible app projection.
- [x] 4.8.1 Move the accepted one-line bottom extension and any accepted transcript-open app chrome into backend-owned terminal-2 truth instead of keeping them only in native-host-local OpenTUI composition.
- [x] 4.8.2 Ensure native host and `--web` host both consume the same terminal-2 final app surface, so managed state, bottom heartbeat/actions, and transcript open/placement transitions are visible from both hosts without a second host-owned app truth.
- [x] 4.8.3 If native host keeps OpenTUI/native click, focus, or scrollbar primitives for lawful interaction ownership, prove those primitives act only as control projections and that their accepted visible results are observable from terminal-2 publication rather than surviving solely as host-local state.
- [x] 4.9 Add `--debug` as an explicit cli-shell startup flag and render a one-line top debug bar with frame timing, queue, patch, viewport, and FPS facts only when that flag is enabled.
- [x] 4.10 Update the bottom row to the v9 compact status-bar contract: status icon, current streaming activity part, managed/takeover toggle, and Chat entry with unread count only; do not render the literal `Heartbeat` label or visible shortcut help in the row.
- [x] 4.11 Update Chat transcript chrome to the v9 traditional chat-room scroll contract: pinned-at-bottom follows new messages and streaming parts; user scroll-up preserves anchor and shows a stick-to-bottom/new-message button; successful user send returns to bottom-pinned mode.
- [x] 4.12 Ensure Chat transcript chrome always exposes a visible scrollbar column for message-list position, independent from the shell-terminal viewport scrollbar or viewport truth.
- [x] 4.13 Ensure constrained-space Chat placement may cover the shell as a full panel when needed, while docked placements remain frameless and avoid full enclosing borders.

## 5. Validation

- [x] 5.1 Run `openspec validate separate-cli-shell-app-from-terminal-view-components --strict` after the final authoring pass and again before apply.
- [x] 5.2 Record the opening architecture evidence in `.chat/separate-cli-shell-app-from-terminal-view-components/opening-architecture.md`: implementation paths and contracts clearly separate backend truth, component projection, and app composition, explicitly identify session actor truth and session focus planes for runtime-owned bindings, and explicitly identify geometry authority versus projection-only layers.
- [x] 5.2.1 Record a code-evidence audit proving whether terminal-2 already owns the complete accepted app surface or whether native host still owns a second host-local app surface; if the latter remains true, keep apply blocked and map it to explicit implementation tasks.
- [x] 5.3 Record the closing app effect in `.chat/separate-cli-shell-app-from-terminal-view-components/closing-app-effect.md`: `cli-shell` presents one shell-first surface with exactly one bottom line in collapsed mode, using the archived `add-cli-shell-app` app references as the visual target.
- [ ] 5.4 Acceptance matrix A: with one native `cli-shell` attachment, verify the shell remains the primary surface, the bottom extension stays exactly one line, successful send keeps transcript chrome open, and managed/chat/placement/close/send actions are actually interactive through native click or shortcut paths.
- [x] 5.4.1 Final native Matrix A evidence must come from a real native terminal program that owns the shell window. `tmux`, `cmux`, or similar multiplexer-hosted sessions may inform debugging but do not count as final acceptance truth for native geometry, native interaction, or startup readiness.
- [x] 5.4.2 In Matrix A, record which modifier truth the owning native terminal program actually delivers for tested shortcut paths, and prove app action semantics do not rely on one mocked `meta` interpretation.
- [x] 5.4.3 If the owning native terminal program blocks one configured shortcut, record that host-blocked fact explicitly and still prove the same app action through native click or another host-lawful interaction path.
- [x] 5.4.4 In Matrix A, record which OpenTUI/native primitive owns each accepted managed/open/placement/close/send path, and fail acceptance if a final path still depends on transparent overlay hotspot geometry or plain-text mouse handlers.
- [x] 5.5 Acceptance matrix B: with one `shell-terminal-view` attachment and one `web-terminal-view` attachment bound to the same backend terminal at the same time, verify shared visible input results and pointer, wheel, or scrollbar-driven shared scrolling in both directions.
- [x] 5.5.1 In Matrix B, prove terminal-2 app-surface parity across native and Web attachments: one-line bottom chrome and transcript-open transitions appear from the same backend-owned terminal-2 truth rather than from native-only host overlays.
- [x] 5.5.2 In Matrix B, if native host uses OpenTUI/native interaction primitives, prove the action path is host-local but the accepted visible result is shared through terminal-2 truth rather than remaining native-only.
- [ ] 5.6 Acceptance matrix C: verify terminal projection fidelity across scrollback so color, cursor continuity, real scrollbar continuity, and shared viewport truth do not degrade into split rich/plain-text surfaces.
- [x] 5.6.1 In Matrix C, include a native long-line and repeated-Enter repro proving the repaired shell body does not corrupt through host text reflow.
- [x] 5.6.2 In Matrix C, include a cursor-ownership repro proving shell cursor visibility transfers cleanly to transcript or app input focus and back again according to the OpenTUI focused-renderable tree rather than key-history heuristics, requested-focus intent alone, or another local cursor-owner toggle.
- [ ] 5.6.3 In Matrix C, if a visible shell scrollbar is rendered, include one native repro proving the actual OpenTUI scrollbar primitive thumb/track/page interactions mutate backend viewport truth rather than a host-local scroll mirror, overlay hotspot, or painted shell-glyph scrollbar.
- [x] 5.7 Acceptance matrix D: verify visible Avatar startup only after terminal changes are actually eligible to wake LoopBus observation flow, including one live session trace that captures both pre-ready and post-ready phases and the underlying runtime-owned terminal observation signal transition, not only toolbar text.
- [x] 5.8 For matrices A-D, record each result under `.chat/separate-cli-shell-app-from-terminal-view-components/` with `expected`, `actual`, `evidence`, `failure signal`, and `related archived reopen mapping` so later acceptance does not rely on narrative memory.
- [x] 5.9 Record inherited-law evidence in `.chat/separate-cli-shell-app-from-terminal-view-components/reference-inheritance.md`, proving this change still uses the existing `--backend=<name>` path and the existing one-line markdown bottom projection law rather than replacing them.
- [x] 5.10 Record precondition evidence proving completed current-worktree changes `promote-ghostty-native-cli-shell` and `promote-ghostty-native-terminal-backend` are the inherited base for this change.
- [x] 5.10.1 Record which viewport mutation shape is actually used by the repaired transport/runtime contract and prove it still resolves back through backend terminal truth rather than a frontend-owned state machine.
- [x] 5.10.2 Record which attachment is geometry-authoritative during native `cli-shell` acceptance and which concurrent attachments are projection-only.
- [x] 5.10.2.1 Record that geometry-authority evidence from backend/control-plane truth, not from one host-local lease helper or local resize timing.
- [x] 5.10.2.2 Record whether the authority winner came from explicit `geometry-order` or backend attach-order fallback.
- [x] 5.10.2.3 Record the backend-visible attachment identity and effective resize role used for that conclusion, such as transport acknowledgement or inspection output.
- [x] 5.10.3 Record which actor identity is used for runtime-owned terminal/room grants and focus during cli-shell bootstrap, and prove it derives from session runtime truth rather than avatar catalog metadata.
- [x] 5.10.4 Record which runtime-owned observation fact gates visible Avatar readiness during cli-shell startup, and prove that a live terminal change advances that fact before the ready state is shown.
- [x] 5.11 Track the reopened `add-cli-shell-app` obligations corresponding to archived tasks `3.2`, `3.5`, and `3.6` for session-actor-correct grants, session-scoped focus, and repeated attach under principal mismatch.
- [x] 5.12 Track the reopened `add-cli-shell-app` obligation corresponding to archived task `4.7` for real interactive toolbar actions under the repaired projection architecture.
- [x] 5.13 Track the reopened `add-cli-shell-app` obligations corresponding to archived tasks `4.13` and `4.14` for shell-input routing and app-action isolation under the repaired projection architecture.
- [x] 5.14 Track the reopened `add-cli-shell-app` obligation corresponding to archived task `4.15` for geometry-authority-correct resize handling.
- [x] 5.15 Track the reopened `add-cli-shell-app` obligations corresponding to archived tasks `4.17` and `4.22` for continuous renderer-surface fidelity and focused behavior revalidation.
- [ ] 5.16 Track the reopened `add-cli-shell-app` obligation corresponding to archived task `5.5` and rerun the real app walkthrough against the original reference effects after this corrective architecture change passes.
- [x] 5.17 Record explicit architecture evidence proving why raw ANSI or VT transport is boundary-local only in this app, and why canonical multi-view sync instead follows backend screen truth rather than frontend terminal emulation truth.
- [x] 5.18 Record automated evidence for scrollbar single-source behavior, client-paced pull-frame protocol cleanup, and the `--debug` performance bar in `.chat/separate-cli-shell-app-from-terminal-view-components/2026-05-13-scrollbar-debug-automation.md`.
- [x] 5.19 Add v9 ChatTUI effect-confirmation assets under `openspec/changes/separate-cli-shell-app-from-terminal-view-components/assets/`, including PNG review images, SVG companions, TXT terminal-grid contracts, and a deterministic generator.
- [x] 5.20 During final apply verification, compare the implemented collapsed, Chat-pinned, and Chat-scrolled-up states against the v9 reference images and record deviations with screenshot evidence.
