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
Runtime terminal realtime publications SHALL invalidate terminal surface resource families explicitly so client stores can refresh catalog, grants, approvals, and activity without rebuilding terminal truth in route-local code. Live render-only facts such as terminal `snapshot/status` ticks SHALL NOT be escalated into `catalogChanged`.

#### Scenario: Terminal activity invalidates only activity consumers
- **WHEN** terminal activity changes for one terminal
- **THEN** runtime publications identify that terminal in the activity invalidation set
- **THEN** client consumers can refresh terminal activity without recomputing unrelated surface resources

#### Scenario: Grant change invalidates seat projection consumers
- **WHEN** a terminal grant is issued or revoked
- **THEN** runtime publications identify that terminal in the grant invalidation set
- **THEN** client consumers can refresh call-as and seat projection data from one authoritative path

#### Scenario: Snapshot and status ticks stay out of catalog invalidation
- **WHEN** a stopped terminal boots through transport and emits live `snapshot` or `status` updates for renderer hydration
- **THEN** runtime publications do not mark `catalogChanged`
- **AND** browser terminal consumers do not refetch `terminal.globalList` for those render-only ticks

### Requirement: Shared terminal environments SHALL preserve real home semantics
When the runtime creates or recovers a shared terminal, it SHALL preserve the operator's real home-directory semantics unless the caller explicitly overrides `HOME`. Shared terminals are collaboration surfaces comparable to `public-workspace`, so the runtime MUST NOT rewrite `HOME` to the avatar root workspace and MUST NOT auto-mount root-workspace-exclusive CLI helpers or avatar-private control-plane env merely because the runtime has one fixed root workspace.

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
