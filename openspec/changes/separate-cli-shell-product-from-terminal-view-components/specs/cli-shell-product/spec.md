> Superseded note:
> This delta spec is built on the older `terminal-1` / `terminal-2` cli-shell ontology.
> It remains only as historical analysis and reference input. Current work must follow `realign-cli-shell-with-core-system-boundaries`.

## MODIFIED Requirements

### Requirement: Cli-shell SHALL compose `shell-terminal-view` as its primary shell surface

Cli-shell SHALL render a shell-first app whose primary visible surface is `shell-terminal-view` bound to terminal-2. Terminal-1 remains the only shell truth, and a backend-owned protocol-2 composition pipeline projects terminal-1 plus accepted app chrome into terminal-2. In the collapsed default state, the app UI SHALL intrude only as a one-row bottom extension.

#### Scenario: First screen shows one active shell-terminal-view with one-line bottom extension

- **WHEN** cli-shell renders after orchestration succeeds
- **THEN** the main body renders ordinary shell content for terminal-2 through `shell-terminal-view`
- **AND** Agenter app chrome is confined to one bottom row
- **AND** no top status line, header, route tabs, dashboard frame, left rail, shell list, session list, tab strip, or terminal switcher is rendered
- **AND** the bottom row does not replace shell ownership of terminal scrolling, cursor, or input semantics

#### Scenario: Attached terminal resource remains shell truth even if runtime focus still points elsewhere

- **GIVEN** cli-shell bootstrap or reconnect has bound app session `shell-liveproof-a1`
- **AND** the reused session runtime still reports another focused terminal such as `shell-1`
- **WHEN** cli-shell rebuilds the shell model
- **THEN** the main shell surface remains bound to terminal-2 for that app session
- **AND** the app does not silently replace that shell body with the older runtime focus projection

#### Scenario: Bottom extension remains orthogonal to shell ownership

- **WHEN** cli-shell renders app metadata or extension actions
- **THEN** the bottom row projects extension state without becoming the terminal viewport owner
- **AND** shell scrolling, shell cursor state, and shell lifecycle truth still come from the backend terminal

#### Scenario: Bottom status row uses the compact v9 information architecture

- **WHEN** cli-shell renders the collapsed bottom row
- **THEN** the row is arranged as status icon, current streaming activity part, managed/takeover toggle, and Chat entry with unread count
- **AND** it does not render the literal label `Heartbeat`
- **AND** it does not render visible shortcut instructions in the row
- **AND** it does not render backend status facts as separate chips unless those facts are part of the current streaming activity summary

#### Scenario: Activity status icon uses terminal-scannable state symbols

- **WHEN** assistant activity is idle, text-progressing, thinking, tool-calling, message-operating, or terminal-operating
- **THEN** cli-shell renders one compact status icon for that state
- **AND** emoji are valid for this icon when terminal-width measurement is handled correctly

#### Scenario: Current streaming activity summarizes built-in tool work

- **WHEN** the latest displayable activity comes from message, terminal, or attention built-in tool work
- **THEN** cli-shell renders a compact human-readable summary in the streaming activity zone
- **AND** it does not dump raw tool payload into the one-line bottom row
- **AND** raw tool truth remains available through the backend event, message, or terminal systems

#### Scenario: Current v9 effect references are tracked in the change

- **WHEN** reviewers inspect this change
- **THEN** `assets/cli-shell-chat-tui-reference-v9-toolbar-grid.png` is available as the collapsed bottom-toolbar app-effect reference
- **AND** `assets/cli-shell-chat-tui-reference-v9-toolbar-grid.svg` and `assets/cli-shell-chat-tui-reference-v9-toolbar-grid.txt` are available as its deterministic vector and terminal-grid companions
- **AND** `assets/cli-shell-chat-tui-reference-v9-chat-right-pinned-grid.png` is available as the Chat-open pinned-at-bottom app-effect reference
- **AND** `assets/cli-shell-chat-tui-reference-v9-chat-right-pinned-grid.svg` and `assets/cli-shell-chat-tui-reference-v9-chat-right-pinned-grid.txt` are available as its deterministic vector and terminal-grid companions
- **AND** `assets/cli-shell-chat-tui-reference-v9-chat-right-scrolled-grid.png` is available as the Chat-open scrolled-up app-effect reference with visible stick-to-bottom affordance
- **AND** `assets/cli-shell-chat-tui-reference-v9-chat-right-scrolled-grid.svg` and `assets/cli-shell-chat-tui-reference-v9-chat-right-scrolled-grid.txt` are available as its deterministic vector and terminal-grid companions
- **AND** `assets/generate-chat-tui-references.ts` is available as the deterministic regeneration source

### Requirement: Terminal-2 SHALL own the complete accepted final app surface

When cli-shell declares terminal-2 as the final visible app terminal, the accepted app surface for that session SHALL live in terminal-2 truth itself. The accepted one-line bottom extension and any accepted transcript-open state SHALL therefore be backend-authored terminal-2 facts rather than native-host-local overlays that another terminal-2 attachment cannot observe.

#### Scenario: Native and Web attachments observe the same bottom chrome truth from terminal-2

- **GIVEN** one native cli-shell host attachment and one `agenter shell --web` attachment are connected to the same terminal-2
- **WHEN** terminal-2 publishes the collapsed final app surface
- **THEN** both hosts observe the same one-line bottom chrome from terminal-2 truth
- **AND** native host does not supply an extra accepted bottom bar that the Web attachment cannot observe

#### Scenario: Native and Web attachments observe the same transcript-open state from terminal-2

- **GIVEN** one native cli-shell host attachment and one `agenter shell --web` attachment are connected to the same terminal-2
- **WHEN** transcript chrome is opened, closed, or re-placed as part of the accepted final app surface
- **THEN** both hosts observe the same terminal-2 app-surface transition
- **AND** accepted transcript-open state is not preserved only in native-host-local OpenTUI composition

#### Scenario: Host-local accepted overlays do not satisfy terminal-2 final-truth law

- **WHEN** a host paints accepted bottom chrome, transcript-open state, or another accepted app-surface element outside terminal-2 truth
- **THEN** that host-local layer does not count as satisfying the terminal-2 final app-truth requirement
- **AND** apply remains blocked until terminal-2 owns that accepted app state

### Requirement: Cli-shell SHALL provide explicit transcript chrome only as optional extension chrome

Cli-shell MAY provide explicit transcript chrome for the app room, but that transcript chrome SHALL remain optional extension chrome separate from shell ownership. It SHALL read durable room truth, SHALL NOT create another terminal truth, and SHALL NOT reuse the one-line bottom extension as a transcript pane.

#### Scenario: Optional transcript chrome opens without replacing the shell

- **WHEN** the user invokes the configured transcript-open gesture
- **THEN** cli-shell may render the app room conversation in explicit side or floating transcript chrome
- **AND** the shell remains the single active visible app-terminal surface
- **AND** the one-line bottom extension does not expand into a second transcript panel

#### Scenario: Transcript chrome reads durable room truth

- **WHEN** transcript chrome is open for `shell-1`
- **THEN** it renders messages from the durable app room for `shell-1`
- **AND** it does not keep a separate local transcript as authoritative truth

#### Scenario: Transcript chrome closes back to the one-line shell-first default

- **WHEN** transcript chrome is open
- **AND** the user closes or cancels it
- **THEN** cli-shell returns to the one-line bottom extension default
- **AND** terminal input ownership returns to shell mode

### Requirement: Cli-shell transcript chrome SHALL not use bottom as multi-row transcript placement

If cli-shell provides explicit transcript chrome, placement SHALL remain an extension concern rather than shell truth. Transcript chrome MAY use side or floating placement, but bottom remains reserved for the one-line extension and SHALL NOT be reused as a multi-row transcript placement.

#### Scenario: Transcript chrome prefers side placement before floating fallback

- **WHEN** the user opens transcript chrome and horizontal space is sufficient
- **THEN** cli-shell may place that transcript chrome on the right or left side
- **AND** it does not consume the one-line bottom extension as a multi-row transcript area

#### Scenario: Resize may switch between side and floating transcript chrome

- **WHEN** the shell-terminal is resized and the current transcript placement falls below its minimum viable threshold
- **THEN** cli-shell may switch between side and floating transcript chrome
- **AND** it does not convert bottom into a multi-row transcript placement

### Requirement: Cli-shell SHALL keep shell input as the default input owner while keeping extension actions explicitly interactive

Cli-shell SHALL forward shell-terminal input to the current shell session terminal path by default. App affordances such as transcript entry, extension buttons, or assistant controls SHALL use explicit interaction paths, and SHALL NOT replace shell input ownership unless the user explicitly enters that separate interaction mode.

#### Scenario: Printable input goes to the shell by default

- **WHEN** cli-shell is in terminal mode and the user types printable characters
- **THEN** cli-shell forwards those characters to the current shell session terminal path
- **AND** other same-terminal views can observe the resulting visible shell changes from the shared backend truth

#### Scenario: Terminal control keys remain shell-owned by default

- **WHEN** cli-shell is in terminal mode and the user presses terminal control keys such as `Ctrl+C`
- **THEN** cli-shell forwards those controls to the current shell session terminal path
- **AND** the app does not reinterpret those keypresses as local shell-exit or local toolbar actions by default

#### Scenario: Explicit extension actions do not leak into shell input bytes

- **WHEN** the user triggers a configured bottom-extension action through click or shortcut
- **THEN** cli-shell routes that activation to the app extension action path
- **AND** `shell-terminal-view` does not emit that activation as shell input bytes to the backend terminal

#### Scenario: Native app affordances are backed by named host primitives

- **WHEN** cli-shell renders visible native actions such as managed toggle, transcript open, placement controls, close, or send
- **THEN** each accepted action path is owned by an OpenTUI focusable/clickable primitive or another explicitly named host primitive
- **AND** cli-shell does not rely on transparent overlay hotspot geometry or plain text mouse handlers as the final interaction truth for those actions

#### Scenario: App action semantics stay valid even when shortcut delivery differs by native host

- **WHEN** cli-shell defines a app action such as transcript open, transcript close, placement change, send, or managed toggle
- **THEN** that action remains a app-semantic contract independent of any one modifier interpretation such as `meta`
- **AND** native shortcut delivery may still be validated per owning host without redefining the app action itself

#### Scenario: Final native shortcut acceptance records delivered modifier truth

- **WHEN** final Matrix A acceptance is captured in a real native terminal program
- **THEN** the acceptance record names which modifier truth actually reached cli-shell for the tested shortcut path, such as `meta`, `super`, `option`, or host-blocked
- **AND** the record does not treat a mocked shortcut path alone as proof of real native shortcut reachability

#### Scenario: Host-blocked shortcut does not erase the app action contract

- **WHEN** the owning native terminal program blocks one configured shortcut before cli-shell receives it
- **THEN** acceptance records that host-blocked fact explicitly
- **AND** cli-shell still proves the same app action through native click or another host-lawful interaction path
- **AND** the app does not relabel the missing shortcut delivery as if the app action itself were absent

#### Scenario: Pointer-driven shell scrolling mutates shared viewport truth

- **WHEN** the user scrolls `shell-terminal-view` through pointer, wheel, or scrollbar interaction
- **THEN** cli-shell routes that interaction as a viewport-mutation request against backend terminal truth
- **AND** the initiating native surface treats the authoritative republished viewport as the visible-truth confirmation
- **AND** other same-terminal attachments can observe the same viewport result

#### Scenario: Visible shell scrollbar is real and truth-bound

- **WHEN** cli-shell renders a visible scrollbar for `shell-terminal-view`
- **THEN** that scrollbar is the OpenTUI scrollbar primitive for the native shell surface, not a painted shell glyph or overlay-only simulation
- **AND** it reflects backend-authored viewport position and extent
- **AND** scrollbar interaction routes through the same backend viewport-mutation contract as wheel or pointer scroll, including absolute viewport-target requests when the thumb itself is dragged
- **AND** track clicks, page-step motions, or other OpenTUI scrollbar affordances, if present, resolve through that same backend viewport-mutation contract
- **AND** the app does not keep a host-local fake scroll state for the shell body
- **AND** cli-shell does not represent shell scroll position by painting a pseudo-scrollbar into ordinary shell text rows

#### Scenario: Sending a room message does not auto-close transcript chrome

- **GIVEN** transcript chrome is open and its draft input owns focus
- **WHEN** the user sends a room message successfully
- **THEN** cli-shell clears the sent draft
- **AND** transcript chrome remains open
- **AND** the app does not silently switch back to collapsed shell-only chrome
- **AND** if transcript input still owns native focus after send, shell-terminal-view does not reclaim the visible cursor until focus actually returns

#### Scenario: Chat transcript follows new messages when pinned at bottom

- **GIVEN** Chat transcript chrome is open
- **AND** the transcript scroll position is pinned at the bottom
- **WHEN** a new room message or streaming message-part is appended
- **THEN** the transcript remains pinned to the latest visible message content
- **AND** no stick-to-bottom button is shown

#### Scenario: Chat transcript preserves user scroll position when scrolled upward

- **GIVEN** Chat transcript chrome is open
- **AND** the user has scrolled upward away from the bottom
- **WHEN** a new room message or streaming message-part is appended
- **THEN** the transcript preserves the user's current scroll anchor
- **AND** the panel shows a compact stick-to-bottom or new-message button
- **AND** the panel does not force-scroll to the latest message until the user explicitly returns to bottom-pinned mode

#### Scenario: Stick-to-bottom action returns Chat to pinned mode

- **GIVEN** Chat transcript chrome is open
- **AND** the user has scrolled upward away from the bottom
- **WHEN** the user activates the stick-to-bottom action
- **THEN** the transcript scrolls to the latest visible message content
- **AND** future appended messages follow automatically while the transcript remains pinned
- **AND** the stick-to-bottom button is hidden after the transcript is pinned

#### Scenario: Sending a user message pins Chat to bottom

- **GIVEN** Chat transcript chrome is open
- **AND** the user has scrolled upward away from the bottom
- **WHEN** the user sends a room message successfully
- **THEN** cli-shell clears the sent draft
- **AND** the transcript scrolls to the latest visible message content
- **AND** future appended messages follow automatically while the transcript remains pinned

#### Scenario: Chat panel exposes a transcript scrollbar independent of shell viewport

- **WHEN** Chat transcript chrome is open
- **THEN** the message list has a visible scrollbar column
- **AND** that scrollbar reflects chat transcript position and extent
- **AND** it does not represent shell-terminal viewport position
- **AND** shell viewport scrolling still follows the backend terminal viewport contract

### Requirement: Cli-shell SHALL bind visible cursor ownership to explicit focus ownership

Cli-shell SHALL bind visible cursor ownership to explicit focus ownership. When `shell-terminal-view` owns focus, the visible cursor belongs to the current shell-session terminal projection. When transcript entry or another explicit app input owns focus, that app input surface owns the visible cursor instead.

#### Scenario: Focused shell-terminal-view owns the visible cursor

- **WHEN** the shell body owns native focus
- **THEN** the visible cursor reflects backend terminal cursor truth for the attached shell
- **AND** app transcript or toolbar inputs do not also present themselves as the active cursor owner
- **AND** only one surface presents itself as the active visible cursor owner at a time

#### Scenario: Focused transcript input owns the visible cursor

- **WHEN** transcript chrome input or another explicit app input box owns native focus
- **THEN** that app input surface owns the visible cursor
- **AND** shell-terminal-view does not continue presenting itself as the active cursor owner until shell focus is restored
- **AND** only one surface presents itself as the active visible cursor owner at a time

#### Scenario: Click focus transfer moves the visible cursor owner

- **GIVEN** shell-terminal-view and transcript chrome are both visible
- **WHEN** the user clicks or otherwise points focus from the shell box into the transcript input box, or back again
- **THEN** OpenTUI focus ownership and the focused-renderable tree move with that focused box transition
- **AND** the sole visible cursor owner changes with that same focus transition
- **AND** cli-shell does not keep a separate cursor-owner toggle outside explicit focus truth
- **AND** cli-shell does not continue showing shell cursor ownership merely because requested focus intent still says `terminal` after the OpenTUI focused-renderable tree has moved elsewhere

### Requirement: Cli-shell SHALL derive backend terminal geometry from shell-terminal-view native geometry

Cli-shell SHALL derive two related backend geometries from the native shell window. Terminal-2 final app-surface geometry SHALL match the native shell window's full visible size. Terminal-1 shell-truth geometry SHALL be derived from that terminal-2 app-surface geometry after subtracting the collapsed one-row bottom extension and any docked transcript columns that belong to the accepted final app surface. `shell-terminal-view` SHALL derive those geometries from the native shell window rather than from host-local free resize controls.

#### Scenario: Initial app and shell geometries stay distinct

- **GIVEN** the native shell-terminal is 120 columns by 40 rows
- **WHEN** cli-shell renders with a one-row collapsed bottom extension
- **THEN** it configures terminal-2 final app-surface geometry for that shell session with 120 columns and 40 rows
- **AND** it configures terminal-1 shell-truth geometry with 120 columns and 39 rows
- **AND** it renders app extension content only in the reserved bottom row

#### Scenario: Native shell window resize updates backend terminal geometry

- **WHEN** the native shell window is resized
- **THEN** cli-shell recomputes terminal-2 final app-surface geometry from the full native shell window size
- **AND** it recomputes terminal-1 shell-truth geometry from that app-surface geometry after subtracting reserved app chrome
- **AND** it updates backend terminal cols and rows through the authoritative terminal path for the correct terminal role
- **AND** `shell-terminal-view` does not keep an independent free-resize geometry model

#### Scenario: Web attachments do not silently replace cli-shell geometry authority

- **GIVEN** cli-shell already owns geometry for `shell-1` through `shell-terminal-view`
- **WHEN** another `web-terminal-view` attachment changes local panel size
- **THEN** that Web host adapts presentation locally
- **AND** backend terminal cols and rows remain derived from `shell-terminal-view` and the native shell window until authority changes explicitly

#### Scenario: Native acceptance records backend-resolved geometry winner rather than inferring it

- **GIVEN** native `cli-shell` and at least one concurrent projection attachment are connected to the same backend terminal truth
- **WHEN** final geometry-authority acceptance is recorded
- **THEN** the acceptance record names the backend-resolved winning attachment and the competing projection-only attachments from backend truth
- **AND** it also records whether the winner came from explicit `geometry-order` or attach-order fallback
- **AND** it does not treat one host-local claim helper or observed local resize behavior as sufficient proof by itself

### Requirement: Cli-shell SHALL expose active terminal observation as app startup truth

Cli-shell SHALL treat visible Avatar startup as active shell-truth observation readiness. The app-visible startup state MUST indicate when terminal-1 changes can wake LoopBus and participate in assistant understanding, rather than relying only on local heartbeat wording or process bootstrap assumptions.

#### Scenario: LoopBus-ready observation counts as Avatar started

- **WHEN** cli-shell has attached the backend terminal and terminal semantic changes can wake LoopBus observation flow
- **THEN** the app may present the Avatar as started or ready
- **AND** that readiness is based on terminal observation truth rather than on a local-only toolbar string

#### Scenario: Runtime bootstrap without terminal observation is not sufficient startup evidence

- **WHEN** runtime processes have auto-started but terminal observation is not yet active
- **THEN** cli-shell does not present full Avatar-started readiness
- **AND** the app does not treat a heartbeat placeholder alone as sufficient evidence
