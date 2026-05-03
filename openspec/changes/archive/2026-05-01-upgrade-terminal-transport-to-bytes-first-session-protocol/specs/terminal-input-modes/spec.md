## MODIFIED Requirements

### Requirement: Interactive terminal forwarding SHALL remain a separate bytes-first live path

terminal-core MAY retain a direct forwarding API for live human interaction, but that path SHALL remain distinct from automation pending truth. The authoritative form of live interaction is terminal input bytes, not browser semantic events and not automation write records.

Interactive live forwarding includes ATI-CLI, ATI-TUI, and terminal-view websocket transport. These callers SHALL use terminal-native input bytes for responsiveness while automation-facing runtime or control-plane paths stay pending-backed.

#### Scenario: Interactive forwarding bypass is not the automation source of truth

- **WHEN** ATI-CLI or ATI-TUI forwards keystrokes through the live forwarding API
- **THEN** the input reaches the PTY immediately for interactive responsiveness
- **AND** automation-facing runtime or control-plane paths still use pending-backed raw or mixed input instead of that direct bypass

#### Scenario: Terminal-view live forwarding is bytes-first rather than text-first

- **WHEN** terminal-view forwards xterm interactive input through websocket transport
- **THEN** the authoritative live payload is terminal input bytes
- **AND** the transport does not require those interactions to be modeled as user text strings

#### Scenario: Browser semantic input can collapse into terminal-native bytes

- **WHEN** terminal-view observes browser interactions such as arrow keys, bracketed paste, mouse reporting, or focus reporting
- **THEN** it may encode those interactions into terminal-native input sequences
- **AND** terminal-core still receives them as the same live input class rather than as separate automation facts

#### Scenario: Live forwarding remains distinct from pending-backed automation truth

- **WHEN** live interaction reaches the PTY through ATI or websocket transport
- **THEN** the interaction remains a responsiveness path only
- **AND** automation-facing runtime or control-plane paths still use pending-backed raw or mixed input as the durable truth
