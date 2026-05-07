## 0. Product Extension Runtime

- [x] 0.1 Define the product extension descriptor contract for command name, package name, bin metadata, source policy, and capability hints
- [x] 0.2 Add extension-runtime tests proving core packages do not import `@agenter/cli-shell` implementation code or branch on cli-shell grammar, toolbar state, layout, or terminal naming
- [x] 0.3 Define generic product resource binding APIs using `productId`, `resourceKey`, resource kind, and owner-system metadata rather than cli-shell-specific fields
- [x] 0.4 Define product-scoped attention ingress/projection APIs for Heartbeat display, unread/chat signals, terminal idle/dirty signals, and product lifecycle facts
- [x] 0.5 Define generic assistant initialization APIs for product-owned Avatar ensure, prompt-source ensure, and avatar-private memory-pack ensure without product-specific core branches
- [x] 0.6 Define product hosting attention APIs for managed/takeover scheduling, including the literal fixed score key `hosting`, managed-on commits `scores: {"hosting": 1000}`, and mandatory managed-off commits `scores: {"hosting": 0}` with reason `user_disabled`
- [x] 0.7 Define product delegation APIs for managed/takeover terminal write authority with granting user, target Avatar, terminal id, room id, expiry, revocation, policy, and provenance
- [x] 0.8 Add contract tests showing cli-shell can be removed or disabled without breaking core daemon, terminal, room, AvatarRuntime, prompt, memory, or attention modules
- [x] 0.9 Extend or verify minimal attention-cli compatible product APIs for committing, querying, and settling self-evolution attention contexts without adding fixed kernel features such as `auto-dream`; defer watch/schedule primitives to `extend-attention-cli-self-evolution-runtime`
- [x] 0.10 Add contract tests proving self-evolution attention loops do not require `hosting`, do not grant terminal write authority, and remain reusable by future products
- [x] 0.11 Add package-boundary tests proving cli-shell consumes daemon/client-sdk style extension contracts and does not import core runtime internals even during local workspace tests

## 1. Product Launcher

- [ ] 1.1 Add a descriptor-driven product-command registry in `@agenter/cli` that maps `shell` to `@agenter/cli-shell` without importing cli-shell implementation code
- [ ] 1.2 Implement local-first package resolution for `packages/cli-shell` before installed-package and remote npm fallback
- [ ] 1.3 Forward host, port, auth-service options, and remaining argv from `agenter shell ...` into the product process
- [ ] 1.4 Run product bins as foreground interactive processes with inherited stdio and propagated exit status
- [ ] 1.5 Add launcher tests for descriptor lookup, local workspace resolution, unsupported command rejection, no product-specific runtime branch, and remote fallback command construction
- [ ] 1.6 Define and pass the launcher-owned env contract: `AGENTER_DAEMON_HOST`, `AGENTER_DAEMON_PORT`, `AGENTER_AUTH_SERVICE_ENDPOINT`, `AGENTER_PRODUCT_COMMAND`, `AGENTER_PRODUCT_PACKAGE`, and `AGENTER_PRODUCT_SOURCE`
- [ ] 1.7 Add package-runner override tests for remote fallback without executing arbitrary user-supplied package names
- [ ] 1.8 Add launcher/product tests proving cli-shell consumes launcher-owned daemon context and does not create a product-local daemon port-file authority

## 2. Cli-shell Package

- [ ] 2.1 Create `packages/cli-shell` with package metadata, bin entry, TypeScript config, and workspace dependency declarations
- [ ] 2.2 Parse optional `@avatar` mention and `--session` into normalized `avatarNickname` and `shellName`, defaulting the Avatar to `shell-assistant` when no mention is provided
- [ ] 2.3 Connect to the daemon using launcher-provided connection context and perform superadmin auto-login
- [ ] 2.4 Ensure the selected AvatarRuntime is started or reused without using the cli-shell session name as runtime identity, including creating or ensuring the default `shell-assistant` Avatar through generic Avatar/product-extension APIs when absent
- [ ] 2.5 Consume product extension runtime APIs for resource binding, assistant initialization, attention projection, hosting attention, and delegation instead of importing core internals or adding cli-shell special cases to core modules
- [ ] 2.6 Add unit tests for command parsing, default `shell-assistant` ensure, explicit `@avatar` override such as `@default`, shell name normalization, AvatarRuntime identity inputs, extension API consumption, and the rule that historical terminal-assistant role notes do not override an explicit `@avatar` mention
- [ ] 2.7 Initialize missing `shell-assistant` `AGENTER.mdx` with flexible pair-programming, user-understanding, self-evolution, and managed-mode autonomy guidance while explicitly stating self-evolution is orthogonal to managed mode and underlying prompt/memory files remain openly editable user assets
- [ ] 2.8 Initialize missing `shell-assistant` memory roles for `user-model`, `pairing-playbook`, `terminal-habits`, `self-evolution-log`, and `hosting-objective`, and link them explicitly from `AGENTER.mdx`
- [ ] 2.9 Add tests proving prompt/memory initialization is seed-if-missing, does not lock or automatically restore user-edited files, explicit `@avatar` override does not mutate `shell-assistant`, and memory roles live in Avatar-private memory rather than cli-shell process state
- [ ] 2.10 Add shell-assistant prompt guidance and deterministic tests for collaboration-style variance: senior-led, requirement-led, playful/companion-like, and user-specific learned adaptation without fixed archetype branching
- [ ] 2.11 Add prompt/memory tests proving `auto-dream` is only an example self-evolution loop name and no default prompt, score key, or core branch treats it as a built-in feature

## 3. Backend Resource Orchestration

- [ ] 3.1 Implement list-before-create terminal ensure through the generic product resource binding API for terminal resource keys such as `shell-1`
- [ ] 3.2 Ensure terminal grant and focus for the summoned Avatar principal through terminal-system native authority
- [ ] 3.3 Implement product room lookup by generic product metadata `productId=cli-shell` and `resourceKey=<shellName>`
- [ ] 3.4 Create missing product rooms with backend-allocated room ids and visible title `<shellName>`
- [ ] 3.5 Ensure room grant and focus for the summoned Avatar principal through message-system native authority
- [ ] 3.6 Add integration tests for repeated `agenter shell`, explicit `agenter shell @default`, `--session=2`, no duplicate terminal or room creation, and absence of cli-shell-specific backend branches

## 4. Terminal Product TUI

- [ ] 4.1 Build the shell TUI collapsed layout as one shell-terminal attached to one internal terminal, using `assets/cli-shell-product-reference-v8-toolbar-grid.png` as the final product-effect reference, `assets/cli-shell-product-reference-v8-toolbar-grid.svg` as the inspection/regeneration companion, and `assets/cli-shell-product-reference-v8-toolbar-grid.txt` as the cell-grid contract
- [ ] 4.2 Build cli-shell directly on `@opentui/react` primitives without importing dashboard/session-list panels from `@agenter/tui`
- [ ] 4.3 Render terminal identity from durable terminal facts instead of local product state
- [ ] 4.4 Render the default toolbar in three zones: status icon, current Heartbeat, and action buttons
- [ ] 4.5 Implement toolbar state icons for idle, text-progressing, thinking, tool-call, message-tool, and terminal-tool states
- [ ] 4.6 Implement toolbar Heartbeat rendering from the latest message-part, including optimized summaries for message/terminal/attention built-in tool calls
- [ ] 4.7 Implement toolbar action buttons: managed/takeover toggle backed by platform hosting attention plus delegation projections, and chat entry with unread count plus shortcut
- [ ] 4.8 Implement the explicit TUI dialogue panel using `assets/cli-shell-product-reference-v8-dialogue-right-grid.png` as the final product-effect reference, `assets/cli-shell-product-reference-v8-dialogue-right-grid.svg` as the inspection/regeneration companion, and `assets/cli-shell-product-reference-v8-dialogue-right-grid.txt` as the cell-grid contract
- [ ] 4.9 Implement dialogue panel top toolbar placement controls for left, right, floating, bottom, plus close
- [ ] 4.10 Implement dialogue panel Markdown message list with left gutter, right scrollbar, gray user message background, `>` gutter marker, and docked panel separators instead of a full enclosing border
- [ ] 4.11 Implement focused bottom input box with one-line separator, gray background, left `>` gutter, and cursor
- [ ] 4.12 Implement smart dialogue placement on first open and resize using minimum viable thresholds
- [ ] 4.13 Implement terminal-mode input routing so printable keys, paste, arrows, and `Ctrl+C` go to the backend terminal by default
- [ ] 4.14 Implement settings-driven toolbar/chat/dialogue focus/cancel/send behavior without leaking chat input into the backend terminal
- [ ] 4.15 Implement shell-terminal resize handling that updates backend terminal cols/rows after subtracting the one-line toolbar
- [ ] 4.16 Keep UI terminology aligned with v8 references, distinguishing `shell-terminal` from backend `terminal`
- [ ] 4.17 Implement all cli-shell product chrome as terminal cell-grid output: split lines, minimal floating borders, gutter columns, scrollbar columns, background cell ranges, and deterministic width accounting for emoji/CJK glyphs
- [ ] 4.18 Render dialogue short time metadata for each message group and centered date divider rows when visible messages cross a local date boundary
- [ ] 4.19 Implement managed/takeover on behavior as hosting AttentionItem commit with the literal fixed key `scores: {"hosting": 1000}`, plus default write-capable terminal delegation create/refresh
- [ ] 4.20 Implement managed/takeover off behavior as delegation revoke plus mandatory hosting attention settlement `scores: {"hosting": 0}` with reason `user_disabled`, without deleting conversation or read access
- [ ] 4.21 Ensure autonomous terminal writes under managed/takeover use the Avatar actor identity and record delegation/lease provenance, not hidden superadmin writes
- [ ] 4.22 Add focused TUI/view-model tests for initial render, one-line toolbar, toolbar zones, status states, Heartbeat streaming, action buttons/unread count, hosting attention projection, managed delegation projection, optional visual separator, dialogue panel open/close/placement, Markdown list rendering, short time rendering, date divider rendering, focused input, cell-grid alignment, wide glyph width accounting, absence of top product chrome, absence of multi-terminal navigation, terminal hydration, input routing, and resize geometry

## 5. Validation

- [ ] 5.1 Run targeted `@agenter/cli` tests for launcher behavior
- [ ] 5.2 Run targeted product-extension-runtime tests for descriptor isolation, generic resource binding, assistant initialization, attention projection, hosting score lifecycle, delegation lease lifecycle, and no cli-shell imports in core
- [ ] 5.3 Run targeted `@agenter/cli-shell` tests for parsing, orchestration, extension API consumption, prompt/memory initialization, hosting attention, delegation projection, and TUI view-model behavior
- [ ] 5.4 Run app-server/client-sdk tests covering generic product resource binding, terminal ensure, room ensure, grants, AvatarRuntime reuse, prompt/memory ensure, attention ingress, hosting settlement, and delegation lease provenance
- [ ] 5.5 Run a real local walkthrough of `agenter shell`, repeat launch, explicit `agenter shell @default`, detach/reconnect, one-line toolbar, status state transitions, Heartbeat streaming, managed toggle on/off, managed state reconnect, chat unread entry, dialogue panel open/close/placement, short time rendering, date divider rendering, dialogue input send/cancel, terminal `Ctrl+C`, resize, and `agenter shell --session=2` from a separate shell-terminal
- [ ] 5.6 Refresh the v8 PNG/SVG/TXT reference set if product feedback changes the IA, then update `design.md`, specs, and audit evidence to point only at the accepted reference set
- [ ] 5.7 Add long-running real AI semantic-judge tests for shell-assistant self-evolution using `SemanticJudge.judgeStructured` or equivalent existing judge support, with a rubric for user-fit learning, memory quality, self-evolution direction, orthogonality, hosting separation, programmable attention usage, and anti-overfit behavior
- [ ] 5.8 Implement AI evaluation threshold and retry policy: fail below the configured score threshold, retry at most twice to absorb model variance, and treat repeated low scores as prompt or implementation defects
- [ ] 5.9 Run real AI evaluation scenarios for senior-led, requirement-led, and playful/companion-like collaboration traces, and verify the assistant learns from evidence rather than relying on preset archetype labels
- [ ] 5.10 Create and use `.chat/add-cli-shell-product/` during implementation to record contradictions, idealized assumptions, objective pain points, test-overfit pressure, and product/runtime tensions discovered while building the change
- [ ] 5.11 Generate and run a long-script real AI validation suite that simulates many-turn terminal work, user correction, memory update, compact/restart continuity, later reuse of learned memory, and model-response cache behavior; keep normal CI gating explicit but do not replace this suite with deterministic-only assertions
