## ADDED Requirements

### Requirement: Runtime terminal publications SHALL support composed terminal screen truth

Runtime terminal publications SHALL support a composed terminal screen truth where a terminal id publishes backend-authored final screen frames without requiring that terminal id to own a child PTY process.

#### Scenario: Composed terminal publishes final screen
- **WHEN** terminal-2 composes shell offscreen frame, terminal-chat frame, and app chrome
- **THEN** runtime terminal publication SHALL expose terminal-2 as the final app screen truth
- **AND** clients SHALL NOT need host-local app composition to observe the accepted cli-shell app surface

#### Scenario: Composed terminal can be non-PTY-backed
- **WHEN** terminal-2 has no child shell process
- **THEN** runtime terminal publication SHALL still expose terminal identity, geometry, frame sequence, status, and lifecycle facts appropriate for a composed terminal runtime
- **AND** runtime SHALL NOT treat absence of a PTY child as absence of terminal screen truth

#### Scenario: Host projection cache does not become runtime truth
- **WHEN** a native or Web host caches terminal-2 frames for rendering
- **THEN** runtime SHALL NOT promote that host cache into authoritative terminal state
- **AND** runtime publication SHALL remain derived from backend-owned terminal-2 composition

### Requirement: Runtime terminal publications SHALL preserve app-host equivalence for cli-shell

Runtime terminal publications for cli-shell SHALL preserve enough terminal-2 truth for native and Web hosts to render the same final app surface.

#### Scenario: Native and Web consume the same terminal-2 publication
- **WHEN** native cli-shell and `cli-shell --web` attach to one app session
- **THEN** both hosts SHALL consume terminal-2 publication for the visible app screen
- **AND** neither host SHALL require a different runtime terminal truth to show accepted app state

#### Scenario: Runtime records terminal roles without collapsing them
- **WHEN** cli-shell bootstrap creates or recovers terminal roles
- **THEN** runtime-facing facts SHALL distinguish terminal-1 shell truth, terminal-chat independent OpenTUI dialogue backend, and terminal-2 composed app screen
- **AND** runtime SHALL NOT infer that terminal-2 is the shell PTY or that terminal-chat is native PTY scrollback

#### Scenario: Runtime observation keeps terminal-1 shell truth distinct
- **WHEN** AI observation, terminal commits, or LoopBus wakeups consume shell activity
- **THEN** they SHALL derive from terminal-1 shell truth
- **AND** terminal-2 app composition SHALL NOT replace terminal-1 as the shell observation source
