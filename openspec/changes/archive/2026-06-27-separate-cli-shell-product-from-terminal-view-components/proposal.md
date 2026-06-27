> Superseded note:
> This change is built on the older `terminal-1` / `terminal-2` cli-shell ontology and must not be resumed or applied directly.
> Its useful app references and acceptance evidence now serve only as historical input for `realign-cli-shell-with-core-system-boundaries`.

## Why

`add-cli-shell-app` already defined the app direction, terminal-first IA, one-line bottom bar, dialogue-panel references, and the broad end-user effect. Those app goals are not being replaced here.

This follow-up exists because acceptance exposed repeated failures that could not be stably fixed inside the archived implementation path: split renderer fidelity, missing shared viewport truth, uncertain geometry authority, startup UI that still did not prove LoopBus was actually observing terminal change, native affordances that could render without landing on the same app or viewport-mutation truth, and runtime-owned terminal/room bindings that could target the wrong actor truth on a real daemon. Acceptance also exposed one more specific projection failure: the native host could take backend terminal rows that were already projected as terminal truth and hand them back into ordinary host text layout, producing visible long-line corruption, cursor drift, and color discontinuity. That pattern means the problem is architectural, not another round of local TUI patching.

The current draft still conflates three things that must stay orthogonal: shell-terminal truth, app-surface truth, and host-specific projection components. The older wording also assumed that `web-terminal-view` and `shell-terminal-view` should consume one identical shared canonical publication contract. That is the wrong durable law for the refined architecture. Termless has one canonical terminal substrate and one derived projection/composition law:

- protocol 1: raw terminal/emulation transport plus backend-authored snapshot truth for one concrete termless instance
- protocol 2: screen-projection/composition over that same canonical backend truth, used when a terminal-native compositor needs to render one termless instance inside another surface

Protocol 2 is not a second independent transport. It is a derived use of protocol 1's backend-owned truth. Raw ANSI or VT replay may still appear at PTY or renderer edges, but it is not the only multi-view synchronization law.

The same ambiguity also let app bindings treat global avatar catalog metadata as if it were runtime actor truth, and let the native app keep app-local interaction laws even when the backend projection contract was already shared. That ambiguity is exactly what keeps allowing second frontend-owned terminal truths, split render surfaces, wrong-principal grants/focus, startup UI that does not prove LoopBus is actually observing terminal change, and native click/focus behavior that drifts away from the host primitive model.

At proposal time, code audit exposed one more concrete gap that this change had to close rather than paper over: `visibleTerminal` and `ProjectionTerminalRuntime` were still publishing projected shell truth from terminal-1, while the accepted bottom bar, transcript chrome, and other app-local affordances were still painted by the native OpenTUI host as a separate local composition layer. That meant the implementation at that point did not satisfy the stronger law in the original objective: terminal-2 as the backend-owned final app-terminal surface consumed by both native and Web hosts. This change therefore kept that stronger target explicit and treated the surviving host-local chrome layer as unfinished architecture, not as an acceptable durable law. The current implementation path has since moved terminal-2 onto a backend-owned composed runtime; the remaining incomplete work is native-host acceptance evidence, not backend terminal-2 publication law.

## Direction

This change takes one clear architecture direction:

- terminal-1 is the only shell truth
- terminal-2 is the authoritative final app-terminal surface, including accepted app chrome that belongs to the app surface itself
- `shell-1` is only the durable app session key, from which the two terminal binding identities are derived
- runtime-owned terminal/room binding derives actor truth from the session runtime, not from global catalog metadata
- protocol 1 is the base transport; protocol 2 is the derived projection/composition law that consumes it
- `shell-terminal-view` is the native protocol-2 decoder/renderer used to display terminal-2 final app truth inside the owning native host
- `web-terminal-view` is the reusable Web protocol-1 projection component for terminal-native surfaces such as terminal-2
- `cli-shell` is the app that runs both terminal-1 and terminal-2 and uses a protocol-2 composition pipeline to produce terminal-2 so that one-line bottom chrome and dialogue chrome live in terminal-2 truth instead of only in one host-local overlay

This is a supplement to `add-cli-shell-app`, not a replacement for its intended app effect. The archived change remains the place where the shell app's visible target was first defined. This follow-up only adds the missing architecture law required to make that target actually hold under acceptance.

This supplement also makes one constraint explicit because the earlier acceptance discussion kept drifting here: a headless backend plus native/Web projection still counts as a real shell architecture as long as terminal-1 owns PTY interaction, shell buffer, shell scrollback, shell cursor, shell viewport, and shell observation truth; terminal-2 owns the final app terminal surface; and projection hosts only render terminal-native truth or route explicit input back to it. What is rejected is not the projection architecture itself, but any implementation where a host silently becomes another terminal truth, where accepted app chrome survives only as host-local composition outside terminal-2, or where web and native are forced to invent a second independent transport tree instead of consuming the same raw transport law.

This supplement also tightens one acceptance discipline because earlier walkthroughs drifted into the wrong host environment: final native `cli-shell` acceptance must be captured in a real native terminal program that actually owns the shell window. Terminal multiplexer or pseudo-host harnesses such as `tmux` or `cmux` may still be used for exploratory debugging, but they do not count as final acceptance truth for native geometry, scroll/pointer affordances, or startup behavior.

This supplement also narrows the native corrective path enough to remove one more source of ambiguity: when the current native host already provides explicit primitives for scrollbar and focus ownership, the repaired implementation should reuse those primitives rather than simulating a second local interaction law in text chrome. For the current `cli-shell` stack, that means binding the visible shell scrollbar through the existing OpenTUI scrollbar primitive and binding visible cursor ownership through the explicit OpenTUI focus tree rooted in focusable shell/app boxes and inputs instead of through bespoke pseudo-scrollbars, separate cursor-owner toggles, or last-key heuristics.

This supplement also makes one more acceptance failure explicit because repeated native reruns kept producing a misleading split between green local tests and failing real-terminal behavior: app action semantics and native shortcut delivery semantics are different layers. `cli-shell` may define app actions such as transcript open, close, placement changes, and managed toggle, but a real native terminal host still controls which modifier chords are actually delivered to the app and whether they arrive as `meta`, `super`, `option`, or another modifier shape. A app that hard-binds its visible effect to one assumed modifier interpretation without verifying host-delivered truth is still architecturally incomplete, even if controller tests pass.

This supplement also inherits already-complete current-worktree laws and does not reopen them:

- `promote-ghostty-native-cli-shell` remains the source of truth for `--backend=<name>` and the opt-in `ghostty-native` path
- `promote-ghostty-native-cli-shell` remains the source of truth for the one-line markdown bottom projection rendered through `MarkdownRenderable` and clipped to the last visual line
- `promote-ghostty-native-terminal-backend` remains the source of truth for the app-server/backend projection completeness that this supplement now relies on

Why this direction:

- A real shell app cannot tolerate one visible shell, one committed shell log, and one AI-observed shell all drifting apart.
- Component contracts must stay reusable across native and Web hosts instead of collapsing into one app-specific term.
- Shared terminal collaboration only stays deterministic if visible viewport state is also shared, not only bytes and scrollback.

## What Changes

- Explicitly treat this change as a corrective supplement to archived `add-cli-shell-app`, reopening the unresolved platform obligations behind its failed acceptance. **BREAKING**
- Keep inherited backend-selection and one-line markdown bottom-projection laws in force while repairing the missing single-truth and component-boundary architecture required for those laws to hold under acceptance.
- Replace the old ambiguous host term with two explicit frontend roles and two explicit terminal roles: protocol-1 Web projection through `web-terminal-view`, protocol-2 shell-side rendering through `shell-terminal-view`, shell truth through terminal-1, and final app-terminal truth through terminal-2. **BREAKING**
- Define `cli-shell` as a terminal-native compositor that runs terminal-1 and terminal-2, rather than as a app that merely wraps one directly attached terminal surface with chrome. **BREAKING**
- Require app-extension runtime bindings for cli-shell-owned terminal and room resources to derive grant/focus actor truth from the created or reused session runtime and to land focus through session-owned runtime APIs. **BREAKING**
- Keep the generic binding contract and derive two distinct terminal resource keys from one cli-shell app session key, instead of extending platform binding metadata with a cli-shell-only terminal-role field. **BREAKING**
- Require terminal-1 to remain the single source of truth for shell render cells/styles, shell cursor, shell viewport, durable terminal change log, and LoopBus terminal observation, while terminal-2 remains the single source of truth for the final app terminal surface seen by hosts. **BREAKING**
- Require terminal-2 to carry the complete backend-authored final app surface for the accepted cli-shell experience; host-local bottom bars, transcript chrome, or other accepted app states that cannot be observed from another terminal-2 attachment remain non-compliant. **BREAKING**
- Require same-terminal attachments to share visible viewport truth and visible input results per terminal truth, while making it explicit that terminal-1 and terminal-2 are separate terminal truths with different responsibilities. **BREAKING**
- Define geometry authority separately for the two terminals: terminal-1 owns shell geometry, terminal-2 owns final app-surface geometry, and `web-terminal-view` may project terminal-2 without becoming another terminal authority. **BREAKING**
- Require the native protocol-2 composition/display path to keep backend terminal rows inside a cell-locked rendering pipeline on the way to terminal-2 and the owning host instead of reflowing them through ordinary host text layout. **BREAKING**
- Require visible interaction affordances to route through explicit truth-owning paths: app buttons and shortcuts through app action contracts, and terminal scroll gestures through backend viewport-mutation truth rather than local mirror-only state. **BREAKING**
- Require the current native `cli-shell` stack to treat OpenTUI scrollbar and focus primitives as the only lawful native sources for shell scroll chrome and visible cursor ownership. **BREAKING**
- Require the current native `cli-shell` stack to treat OpenTUI focusable/clickable action primitives, or another explicitly named host primitive, as the only lawful native sources for visible app-action ownership rather than transparent overlay hotspots or plain text mouse-handler chrome. **BREAKING**
- Require `cli-shell` to model native shortcut delivery separately from app action semantics, so real native hosts can prove which configured shortcuts are actually reachable and how their modifiers are delivered. **BREAKING**
- Require visible terminal scrollbars, when present, to remain projections of backend viewport truth rather than host-local fake scroll owners. **BREAKING**
- Require visible cursor ownership in `cli-shell` to follow explicit native focus ownership between `shell-terminal-view` and app input boxes. **BREAKING**
- Clarify that the one-line bottom extension is orthogonal app chrome and that visible Avatar startup means active LoopBus terminal observation rather than a local heartbeat placeholder.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `cli-shell-app`: redefine `cli-shell` as a two-terminal app whose protocol-2 composition pipeline composes shell truth from terminal-1 into backend-owned final app-terminal truth on terminal-2.
- `app-runtime`: clarify that runtime-owned terminal/room binding for products derives actor truth from the session runtime rather than catalog metadata and that focus flows through session-owned runtime APIs.
- `runtime-terminal-contract`: distinguish shell-terminal truth from final app-terminal truth while keeping each one authoritative in its own domain.
- `terminal-pty-transport`: make protocol-1 and protocol-2 explicit and add shared viewport synchronization for same-terminal attachments without weakening bytes-first input law.
- `terminal-view-component`: define `web-terminal-view` and `shell-terminal-view` as related frontend roles over one termless physics stack, not as symmetric consumers of one identical wire contract.

## Impact

- `openspec/specs/cli-shell-app/spec.md`
- `openspec/specs/app-runtime/spec.md`
- `openspec/specs/runtime-terminal-contract/spec.md`
- `openspec/specs/terminal-pty-transport/spec.md`
- `openspec/specs/terminal-view-component/spec.md`
- `packages/cli-shell/src/*`
- `packages/terminal-transport-protocol/src/*`
- `packages/terminal-system/src/*`
- `packages/terminal-view/src/*`
- `packages/termless-core/src/*`
- `packages/client-sdk/src/*`
- `packages/app-server/src/runtime-system-kernel-adapters/terminal-adapter.ts`
- `packages/app-server/src/session-runtime.ts`
- `packages/webui/src/**/*`

## Desired End State

At the end of this change, the target effect is:

- `cli-shell` behaves like a complete shell app, not a dashboard with a terminal embedded inside it
- terminal-1 remains the only shell truth and terminal-2 becomes the backend-owned final app-terminal surface
- `shell-terminal-view` is the native protocol-2 decoder/renderer that displays terminal-2 final app truth inside the owning native host
- `web-terminal-view` remains reusable for WebUI and future Web products that need protocol-1 projection of a terminal-native surface such as terminal-2
- terminal-1 continues to drive durable shell commits and LoopBus observation, while terminal-2 drives the final visible app surface seen by shell and web hosts
- terminal-2 carries the accepted bottom bar and transcript-open app states as backend-authored truth, so native and Web hosts can observe the same final app surface transitions
- multiple attachments to the same terminal stay visibly synchronized, including scroll position and visible input results, but no document pretends terminal-1 and terminal-2 are the same terminal
- native shell projection from terminal-1 into terminal-2 does not corrupt long lines, cursor position, or color continuity through host text reflow
- app actions remain truly interactive through native click or shortcut paths, and scroll gestures remain routed through shared viewport truth rather than host-local replay
- native app affordances such as managed toggle, transcript open, placement controls, close, and send are owned by explicit OpenTUI/native primitives rather than by transparent overlay hitboxes or plain text mouse handlers
- native shortcut-driven app actions are proven against the actual modifier truth delivered by the owning native terminal program rather than by test-only assumptions about `meta`
- if the owning native terminal program blocks a configured shortcut, acceptance records that host fact explicitly and still proves the same app action through native click or another host-lawful delivery path
- successful transcript sends clear only the draft and do not auto-close transcript chrome
- visible shell scrollbar, if rendered, is real and backend-truth-bound
- visible shell scrollbar, if rendered, is the OpenTUI scrollbar primitive itself, and its thumb/track/page gestures round-trip through backend viewport truth rather than overlay hotspots or painted shell glyphs
- visible cursor ownership follows explicit focus ownership between shell and app inputs
- visible cursor ownership follows the OpenTUI focused-renderable tree rather than a separate requested-focus or last-key heuristic
- only one surface presents itself as the active visible cursor owner at a time
- native host may still use explicit OpenTUI/native controls for click, focus, and scroll ownership, but those controls are only lawful as control projections; they do not get to become a second visible app truth alongside terminal-2
- the bottom bar stays one line only
- native host no longer owns a second app-chrome truth that Web attachments to terminal-2 cannot observe
- "Avatar started" means terminal observation is actually live and is backed by runtime-owned terminal observation truth rather than by toolbar copy alone
- native acceptance evidence comes from a real native terminal program rather than from `tmux`, `cmux`, or another multiplexer-hosted substitute
- the visual target for collapsed and transcript-open states still traces back to archived `add-cli-shell-app` references `assets/cli-shell-app-reference-v8-toolbar-grid.*` and `assets/cli-shell-app-reference-v8-dialogue-right-grid.*`

After this corrective change lands, `add-cli-shell-app` must be re-checked as a previously archived but acceptance-broken delivery. The old app effect remains the acceptance target, but it may only be considered truly complete after the reopened architecture obligations are implemented and the end-to-end app is re-accepted.
