# runtime-terminal-contract Specification

## Purpose
Define how app-server runtime publications expose attached global terminal state to clients without duplicating terminal-owned truth.
## Requirements
### Requirement: Runtime publications SHALL prefer focused terminal sets

Runtime snapshots and realtime terminal events SHALL publish the focused set of globally attached terminals for the current session actor, with any single-focus field treated only as a derived compatibility projection.

#### Scenario: Snapshot exposes multiple focused attached terminals
- **WHEN** a session is attached to more than one focused global terminal
- **THEN** the runtime snapshot returns every focused terminal id in `focusedTerminalIds`
- **THEN** clients do not need to reconstruct the set from a single-focus field

#### Scenario: Snapshot exposes session actor focus instead of a shared global flag
- **WHEN** the current session actor focuses terminals through terminal-system
- **THEN** the runtime snapshot returns those focused terminal ids in `focusedTerminalIds`
- **THEN** the client does not treat another actor's focus set as if it belonged to this session

#### Scenario: Compatibility field remains derived
- **WHEN** a compatibility field such as `focusedTerminalId` is still present
- **THEN** its value is derived from `focusedTerminalIds`
- **THEN** it does not replace `focusedTerminalIds` as the primary contract

### Requirement: Runtime terminal reads SHALL carry explicit representation metadata

Whenever runtime events or snapshots include terminal read results, the payload SHALL declare whether the representation is a diff or a snapshot, SHALL preserve the global terminal id, title, and status context needed by terminal-facing UI, SHALL expose whether the read was recorded into durable activity history, and SHALL carry actor-scoped read cursor metadata when git-log cursors are available.

#### Scenario: Runtime publishes a compact diff representation
- **WHEN** the terminal read path chooses a diff as the compact representation
- **THEN** the payload declares `representation = diff`
- **THEN** client consumers can render or label that result without payload-shape inference

#### Scenario: Runtime snapshot carries full terminal hydration data
- **WHEN** a session publishes terminal snapshot truth for a terminal surface
- **THEN** the runtime payload includes the full renderable snapshot needed for viewport hydration
- **THEN** terminal-facing UI does not need a second side channel to restore the viewport

#### Scenario: Runtime distinguishes pure reads from recorded observations
- **WHEN** a terminal read is executed without activity recording
- **THEN** the runtime payload identifies the representation without appending or implying a durable activity event
- **THEN** client consumers can inspect terminal state without fabricating activity history

#### Scenario: Runtime read carries actor cursor metadata
- **WHEN** a consuming runtime terminal read advances a git-log backed terminal cursor
- **THEN** the payload exposes `readCursor.readerActorId`
- **AND** the payload exposes the cursor `fromHash`, `toHash`, and `consumed` status
- **AND** client-side optimistic activity can attribute the read to the same actor without guessing from route state

### Requirement: Runtime boot SHALL not auto-create default terminals

Runtime boot SHALL attach terminals only through explicit durable terminal attachments or explicit runtime orchestration. It MUST NOT auto-create or auto-focus terminals solely because session config contains terminal presets.

#### Scenario: Fresh runtime boot has no hidden terminal attachment
- **WHEN** a runtime starts without any previously attached terminal fact
- **THEN** runtime boot does not auto-create a terminal from preset config
- **AND** no terminal becomes focused until explicit terminal orchestration occurs

#### Scenario: Recovery boot restores explicit terminal attachments only
- **WHEN** a runtime restarts after previously attached terminals were durably recorded
- **THEN** recovery restores only those terminal references that still have valid durable attachment facts
- **AND** it does not create a brand new fallback terminal during boot

### Requirement: Dynamic terminal creation SHALL resolve cwd from explicit runtime context

When the AI uses runtime terminal tooling to create a terminal, the runtime SHALL resolve `cwd` from explicit runtime mount context or reject the request. It MUST NOT fall back to `homedir()` when `cwd` is omitted.

#### Scenario: One mounted workspace supplies implicit cwd
- **WHEN** the AI creates a terminal without providing `cwd` and the runtime has exactly one eligible mounted workspace root
- **THEN** the runtime uses that workspace root as the terminal cwd
- **AND** terminal creation remains inside explicit workspace context

#### Scenario: Missing or ambiguous workspace context rejects terminal creation
- **WHEN** the AI creates a terminal without `cwd` and the runtime has zero or multiple eligible workspace roots
- **THEN** the runtime rejects the request with a clear error explaining that explicit `cwd` or workspace mount context is required
- **AND** it does not create a terminal in the user home directory

### Requirement: Runtime terminal surface invalidation SHALL refresh one resource family at a time
Runtime terminal realtime publications SHALL invalidate terminal surface resource families explicitly so client stores can refresh catalog, history, grants, approvals, and activity without rebuilding terminal truth in route-local code. Live render-only facts such as terminal `snapshot/status` ticks SHALL NOT be escalated into catalog invalidation, and killed terminals SHALL leave live terminal publications when the killed flow completes.

#### Scenario: Terminal activity invalidates only activity consumers
- **WHEN** terminal activity changes for one terminal
- **THEN** runtime publications identify that terminal in the activity invalidation set
- **THEN** client consumers can refresh terminal activity without recomputing unrelated surface resources

#### Scenario: Grant change invalidates seat projection consumers
- **WHEN** a terminal grant is issued or revoked
- **THEN** runtime publications identify that terminal in the grant invalidation set
- **THEN** client consumers can refresh call-as and seat projection data from one authoritative path

#### Scenario: Snapshot and status ticks stay out of catalog invalidation
- **WHEN** a running terminal emits live `snapshot` or `status` updates for renderer hydration
- **THEN** runtime publications do not mark `catalogChanged`
- **AND** browser terminal consumers do not refetch `terminal.globalList` for those render-only ticks

#### Scenario: Lifecycle change invalidates live catalog-facing terminal truth without using snapshot ticks
- **WHEN** a terminal is explicitly bootstrapped, killed, archived, or deleted
- **THEN** runtime publications identify the affected live or history projection mutation explicitly
- **AND** clients do not need to infer lifecycle from `snapshot/status` render ticks

#### Scenario: Observed identity updates stay distinct from launch truth
- **WHEN** the running terminal emits a new title or current path observation
- **THEN** runtime publications can refresh observed identity without mutating launch config fields
- **AND** clients preserve both truths simultaneously

#### Scenario: Real catalog mutation still invalidates catalog consumers
- **WHEN** terminal identity, presence, focus, or other catalog-facing live truth changes
- **THEN** runtime publications still identify the catalog invalidation explicitly
- **AND** catalog consumers can refresh from one authoritative signal

#### Scenario: Killed terminal leaves live publication sets
- **WHEN** the killed flow completes for a terminal that had been attached to the current runtime
- **THEN** runtime publications remove that terminal from live attached and focused terminal sets
- **AND** runtime status caches do not keep presenting it as a normal live terminal

### Requirement: Shared terminal environments SHALL preserve real home semantics

When the runtime creates or recovers a shared terminal, it SHALL preserve the operator's real home-directory semantics unless the caller explicitly overrides `HOME`. Shared terminals are collaboration surfaces comparable to `public-workspace`, so the runtime MUST NOT rewrite `HOME` to the avatar root workspace and MUST NOT auto-mount root-workspace-exclusive CLI helpers or avatar-private control-plane env merely because the runtime has one fixed root workspace or one durable root-workspace shell world.

#### Scenario: New shared terminal keeps real home semantics
- **WHEN** the AI creates a terminal without explicitly setting `HOME`
- **THEN** the terminal environment preserves the real user home directory
- **AND** the runtime does not inject root-workspace-exclusive CLI/env by default

#### Scenario: Recovered shared terminal keeps the same home law
- **WHEN** the runtime recovers or recreates a previously attached terminal
- **THEN** it applies the same real-home default instead of avatar-root `HOME`
- **AND** recovery does not silently change terminal identity semantics

#### Scenario: Avatar-root cwd does not imply avatar-root HOME
- **WHEN** a shared terminal starts with `cwd` inside the avatar root workspace
- **THEN** the terminal still follows shared-terminal home semantics by default
- **AND** root-workspace `HOME` rewrite remains reserved for `root_bash`

#### Scenario: Shared terminal does not inherit root-exclusive CLI
- **WHEN** a shared terminal is created for collaborative work
- **THEN** root-workspace-only helper commands are not auto-mounted into that terminal
- **AND** terminal collaboration does not depend on avatar-private runtime CLI exposure

#### Scenario: Durable root-workspace shell world does not alter shared terminal law
- **WHEN** the runtime upgrades `root-workspace` to one durable singleton shell world
- **THEN** shared terminals still preserve real-home collaboration semantics
- **AND** the root-workspace implementation change does not rewrite terminal env or CLI defaults

### Requirement: Runtime terminal await SHALL return structured bounded observation evidence

Runtime terminal await results SHALL expose the await outcome and bounded terminal evidence in a stable JSON contract. The contract SHALL include enough clean snapshot text for the AI to continue reasoning without an immediate follow-up `terminal read`, while preserving bounded output limits.

#### Scenario: Matched await returns snapshot lines and match context
- **WHEN** the AI runs `terminal await` and the configured match condition resolves
- **THEN** the runtime result includes `kind = terminal-await`, `outcome = matched`, terminal id, elapsed wait time, terminal running/status truth, and from/to snapshot cursor metadata
- **AND** the result includes bounded clean snapshot lines or tail lines
- **AND** the result includes match evidence with context lines

#### Scenario: Timeout await returns post-mortem snapshot evidence
- **WHEN** the AI runs `terminal await` with a command-level timeout and the condition does not resolve before that timeout
- **THEN** the runtime result includes `outcome = timeout`
- **AND** the result includes the last observed snapshot metadata and bounded clean lines
- **AND** the AI does not need a second read solely to understand what the terminal looked like at timeout

#### Scenario: Await line output remains bounded
- **WHEN** a terminal has more scrollback than the configured await view limit
- **THEN** the runtime await result includes only the bounded view requested by the caller or the default bounded tail
- **AND** it does not return unbounded terminal scrollback by default

### Requirement: Runtime terminal await activity recording SHALL be caller controlled

Runtime terminal await SHALL treat activity recording as an explicit observation control. The operation SHALL record durable terminal observation activity by default, and callers SHALL be able to disable that recording for pure probes.

#### Scenario: Default await records observation activity
- **WHEN** the AI runs `terminal await` without overriding activity recording
- **THEN** the runtime records a terminal observation activity event that includes await outcome metadata
- **AND** the activity event does not fabricate terminal output beyond the returned evidence

#### Scenario: Pure await probe preserves activity history
- **WHEN** the AI runs `terminal await` with activity recording disabled
- **THEN** the runtime returns the same await evidence contract
- **AND** no terminal activity event is appended for that probe

### Requirement: Runtime publications SHALL expose terminal launch truth, observed identity, and process lifecycle separately

Runtime snapshots and terminal realtime publications SHALL expose terminal launch/config truth, runtime observed identity truth, and durable process lifecycle truth as separate fields instead of compressing them into a single `cwd/title/running/status` blob.

#### Scenario: Launch cwd stays separate from observed current path

- **WHEN** a terminal was created with launch cwd `/repo/app` but the running shell later `cd`s to `/repo/app/apps/studio`
- **THEN** the runtime projection preserves `/repo/app` as launch truth
- **AND** it publishes `/repo/app/apps/studio` as observed current path

#### Scenario: Configured title stays separate from observed current title

- **WHEN** a terminal has configured title `Ops shell` but the runtime later emits a different OSC/xterm title
- **THEN** the runtime projection preserves `Ops shell` as configured title
- **AND** it publishes the latest observed title separately for UI resolution

#### Scenario: Process lifecycle stays separate from activity truth

- **WHEN** a terminal PTY exits
- **THEN** the runtime projection preserves whether the terminal is `not_started`, `running`, or `stopped`
- **AND** it records stop reason, exit code/signal, and stopped timestamp separately from `IDLE/BUSY`

### Requirement: Runtime publications SHALL expose terminal lifecycle transitions separately from durable process phase

Runtime snapshots and terminal realtime publications SHALL expose durable `processPhase` and transient `lifecycleTransition` as separate fields so clients and AI can distinguish in-flight coordination locks from durable lifecycle facts.

#### Scenario: Runtime publishes bootstrapping without pretending the PTY is already running

- **WHEN** a newly created or explicitly bootstrapped terminal is still starting
- **THEN** runtime projections can publish `lifecycleTransition = bootstrapping`
- **AND** they do not have to claim `processPhase = running` before the PTY has actually started

#### Scenario: Runtime publishes killing without losing the durable terminal identity

- **WHEN** a terminal stop mutation is in flight
- **THEN** runtime projections can publish `lifecycleTransition = killing`
- **AND** callers can continue to resolve the same durable terminal id
- **AND** once the stop completes the projection settles on `processPhase = stopped`

### Requirement: Runtime terminal config surfaces SHALL expose durable launch truth

Runtime-local terminal config reads and writes SHALL expose durable terminal launch/config truth, including backend selection or backend profile, independently from runtime observed identity truth and viewport renderer fact.

#### Scenario: Runtime get-config returns launch truth

- **WHEN** the AI runs `terminal get-config`
- **THEN** the runtime returns durable launch truth such as `command`, `launchCwd`, `processKind`, backend selection/profile fields, and metadata
- **AND** the caller does not need to infer durable config from `terminal list` or `terminal read`

#### Scenario: Runtime set-config preserves observed identity separation

- **WHEN** the AI updates terminal config while the running PTY later reports a different current path or current title
- **THEN** runtime projections preserve the updated durable config
- **AND** they continue to publish runtime-observed identity separately

#### Scenario: Browser renderer fact does not rewrite backend launch truth

- **WHEN** a terminal launches through the official xterm backend and a browser surface later resolves `resolvedRenderer = xterm`
- **THEN** runtime terminal config continues to expose backend launch truth separately from renderer fact
- **AND** runtime code does not collapse backend selection into browser renderer naming

### Requirement: Runtime terminal truth SHALL derive render, durable change log, and observation from one backend source
Whenever runtime publishes terminal state, renderable terminal state, durable terminal change-log truth, and LoopBus terminal observation ingress SHALL all originate from the same backend terminal truth rather than from client-local reconstructions. Dead-instance history projections SHALL remain backend-owned evidence and SHALL NOT be reconstructed from runtime caches.

#### Scenario: One backend change source drives renderer, commit, and observation truth
- **GIVEN** one backend terminal emits new renderable state
- **WHEN** runtime projects that change
- **THEN** renderer hydration, durable terminal change-log publication, and observation ingress refer to the same backend terminal change source
- **AND** clients do not synthesize a second authoritative transcript to bridge those paths

#### Scenario: Projection caches do not become durable terminal truth
- **WHEN** a client or host keeps local render caches
- **THEN** runtime does not promote those caches into authoritative durable terminal history or observation facts
- **AND** the runtime contract keeps backend terminal state as the only source of truth

#### Scenario: Dead terminal history stays backend-owned
- **WHEN** a terminal has left the live projection through the killed flow
- **THEN** runtime may expose history metadata or invalidation for that instance
- **AND** it does not reconstruct the dead terminal as a live attachment from runtime-local caches

### Requirement: Runtime publications SHALL preserve shared terminal viewport truth

Runtime terminal publications SHALL preserve shared viewport truth for same-terminal attachments when the app contract requires a single visible source of truth. Buffer content, viewport position, and visible input results SHALL remain synchronized across same-terminal clients that participate in that shared terminal attachment.

#### Scenario: Same-terminal clients observe the same visible viewport
- **WHEN** multiple clients attach to the same backend terminal through a shared terminal contract
- **THEN** runtime-facing terminal projections preserve one shared visible viewport truth for that terminal
- **AND** clients do not invent separate authoritative viewport positions for the same attachment

#### Scenario: Visible input results remain synchronized across same-terminal clients
- **WHEN** one same-terminal client sends interactive terminal input
- **THEN** other same-terminal clients can observe the resulting visible shell changes from the same backend terminal truth
- **AND** runtime projections do not require each client to reconstruct those visible changes independently

### Requirement: Runtime publications SHALL distinguish geometry authority from presentation scale

Runtime terminal projections SHALL distinguish backend terminal geometry truth from host-local presentation scaling. When a app host currently owns geometry authority, other projection hosts may present the same terminal grid without silently rewriting backend columns and rows.

#### Scenario: Cli-shell-owned geometry remains explicit to other attachments
- **WHEN** `cli-shell` owns geometry authority for a terminal through `shell-terminal-view`
- **THEN** runtime-facing geometry truth remains derived from the native shell window after subtracting reserved app rows
- **AND** other attachments can observe that geometry without inferring that they own it

#### Scenario: Web host local resize changes presentation only
- **WHEN** a `web-terminal-view` host resizes its local container while another host still owns backend geometry authority
- **THEN** runtime terminal geometry truth remains unchanged
- **AND** the Web host may still recompute local fit, cover, or zoom presentation from that shared geometry

#### Scenario: Attachment resize role is explicit instead of inferred from last writer
- **WHEN** multiple attachments are connected to the same backend terminal truth
- **THEN** runtime/control-plane can distinguish the geometry-authoritative attachment from projection-only attachments
- **AND** backend terminal geometry is not reassigned implicitly just because another projection host resized its local surface

### Requirement: Terminal lifecycle coordination SHALL be scheduler-only

Runtime terminal focus, unfocus, and idle-ready coordination SHALL be treated as scheduler signals or UI invalidations. They MUST NOT be committed as task facts or obligation text in model-visible attention content.

#### Scenario: Focus event does not create an attention task

- **WHEN** a terminal becomes focused for a session actor
- **THEN** runtime updates terminal focus projection and scheduling state
- **AND** it does not commit a `terminal_focus` task fact into model-visible attention

#### Scenario: Unfocus event does not create an attention task

- **WHEN** a terminal becomes unfocused for a session actor
- **THEN** runtime updates terminal focus projection and scheduling state
- **AND** it does not commit a `terminal_unfocus` task fact into model-visible attention

#### Scenario: Idle-ready wakes without instruction text

- **WHEN** a running terminal changes from busy to idle
- **THEN** runtime may wake or rank the loop through scheduler state
- **AND** it does not inject text such as `Terminal <id> is ready for your input` as task truth

### Requirement: Terminal model facts SHALL be objective observations or explicit action results

Terminal content eligible for model reasoning SHALL be limited to objective snapshots, diffs, bounded await evidence, durable process facts, or explicit command/action results.

#### Scenario: Snapshot remains a model fact

- **WHEN** terminal screen content changes and runtime records a snapshot or diff
- **THEN** that observation may become model-visible terminal fact content
- **AND** it is not mixed with focus or idle lifecycle text

#### Scenario: Command result remains an explicit action result

- **WHEN** the model executes a terminal or shell command through an explicit action
- **THEN** runtime records the command result as an explicit action result
- **AND** any follow-up scheduling is kept separate from the result content

### Requirement: Preferred terminal strategies MAY remain guidance

Recommended terminal strategies such as await-first workflows, bounded reads, or compact observation patterns MAY remain in terminal guidance, but they SHALL stay non-binding and SHALL NOT be rewritten as runtime-authored lifecycle obligations.

#### Scenario: Strategy guidance does not become a lifecycle command

- **WHEN** terminal guidance recommends a preferred strategy such as await-before-read
- **THEN** the recommendation may shape the model's command choice as a soft field
- **AND** runtime does not convert that preference into a hidden `ready for your input` instruction or other lifecycle obligation

### Requirement: Runtime terminal publications SHALL carry backend interaction projection state

Runtime terminal publications that feed projection hosts SHALL carry backend-owned interaction projection state when visible rendering requires it. This includes selection overlays, selected owner identity, cursor-follow result facts, and active cursor ownership facts. Runtime SHALL publish these facts as backend truth, not as host-local UI state.

#### Scenario: Runtime frame includes backend selection overlay
- **WHEN** backend selection intersects the visible viewport for a projected terminal
- **THEN** runtime terminal publication SHALL include selection overlay data sufficient for the projection host to draw selected cells
- **AND** selected-text extraction SHALL still be owned by backend interaction APIs

#### Scenario: Runtime publication clears stale selection overlay
- **WHEN** backend selection is cleared or no longer visible
- **THEN** runtime terminal publication SHALL make that cleared state observable to projection hosts
- **AND** hosts SHALL clear stale selection paint instead of preserving host-local highlights

### Requirement: Runtime terminal operations SHALL expose backend-owned cursor-follow

Runtime terminal operations SHALL expose cursor-follow as a backend-owned operation. Products and projection hosts SHALL request cursor-follow through runtime or transport semantics and SHALL wait for runtime-published viewport truth to observe the result.

#### Scenario: Runtime follow cursor uses backend truth
- **WHEN** a projection host requests cursor-follow for a terminal
- **THEN** runtime SHALL apply the operation against backend cursor and viewport truth
- **AND** runtime SHALL publish the resulting viewport through terminal publication

#### Scenario: Runtime does not accept frontend follow as truth
- **WHEN** a projection host computes a viewport from its last rendered cursor frame
- **THEN** runtime SHALL NOT treat that frontend value as the authoritative cursor-follow result
- **AND** backend cursor-follow remains the primary operation

### Requirement: Runtime terminal contract SHALL keep interaction truth separate from app chrome truth

Runtime SHALL distinguish backend terminal interaction truth from app chrome state. App chrome may route events and display results, but terminal selection, copy, cursor-follow, scrollback, and viewport truth SHALL stay attached to the backend or offscreen renderer owner.

#### Scenario: App action does not become terminal selection truth
- **WHEN** cli-shell app chrome receives a click or shortcut
- **THEN** runtime MAY update app state for that action
- **AND** runtime SHALL NOT mutate terminal selection unless the event targets a backend interaction owner

#### Scenario: Terminal selection does not become app-local state
- **WHEN** shell backend selection changes
- **THEN** runtime SHALL publish that selection as terminal interaction projection state
- **AND** cli-shell app state SHALL NOT store a second authoritative selected range

### Requirement: Runtime recovery SHALL compensate dead terminals through terminal-owned killed flow
Runtime recovery SHALL treat stale previously-running terminals as dead history instances and SHALL invoke terminal-owned compensation instead of reconstructing live state locally.

#### Scenario: Restarted runtime does not republish stale dead terminal as live
- **WHEN** runtime recovery encounters a terminal that daemon compensation moved through the killed flow
- **THEN** runtime terminal publications do not reattach or republish that terminal as part of the live focused or attached set
- **AND** callers must use explicit history surfaces to inspect it

