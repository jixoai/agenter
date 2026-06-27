## MODIFIED Requirements

### Requirement: Client runtime store SHALL expose app-facing core resource facades

The client runtime store SHALL expose typed facades for app TUIs to consume TerminalSystem, MessageSystem, AvatarRuntime, and AttentionSystem projections and mutations through daemon/client-sdk contracts. App feature code SHALL NOT import app-server internals or reconstruct current bindings from stale global lists.

#### Scenario: App TUI reads bound terminal through store facade
- **WHEN** cli-shell needs to render its current shell terminal
- **THEN** it can call a typed store facade using the current app binding or terminal id
- **AND** the store returns TerminalSystem projection data suitable for TUI rendering
- **AND** cli-shell does not infer the current target from unrelated catalog rows

#### Scenario: App TUI observes approval requests through store facade
- **WHEN** cli-shell top layer needs pending terminal approvals
- **THEN** it subscribes through a typed store facade keyed by the relevant terminal id or app binding
- **AND** approval state updates when TerminalSystem creates, approves, denies, or expires requests

#### Scenario: App TUI reads room through store facade
- **WHEN** cli-shell Chat opens the MessageRoom surface
- **THEN** it reads and sends messages through typed room snapshot/send facades
- **AND** it does not maintain a app-local transcript as truth

#### Scenario: App TUI reads attention projection through store facade
- **WHEN** cli-shell renders managed or heartbeat state
- **THEN** it reads app-scoped attention and runtime heartbeat projections through typed store facades
- **AND** local status labels remain projections over those facts
