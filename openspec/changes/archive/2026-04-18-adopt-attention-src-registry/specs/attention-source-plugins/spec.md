## MODIFIED Requirements

### Requirement: Attention ingestion SHALL be sourced through source adapters
Message-system, terminal-system, and future systems SHALL integrate with the attention kernel by invalidating protocol-native `src` addresses through registered source namespaces. Source adapters SHALL resolve those registered addresses into context-bound attention drafts, not into flattened LoopBus text facts or generic metadata bags.

#### Scenario: Message invalidation uses a protocol-native room message source
- **WHEN** a message channel configured for attention receives a committed message
- **THEN** the message source plugin invalidates a `src` address such as `msg:<chatId>/<messageId>`
- **AND** runtime resolves that `src` through the registered `msg` namespace before reading attention drafts
- **AND** runtime does not rely on a generic source metadata bag to look the message up again

#### Scenario: Focused terminal invalidation becomes attention input
- **WHEN** a focused terminal produces a semantic change
- **THEN** the terminal source plugin invalidates a `src` address owned by the `tty` namespace
- **THEN** the runtime resolves that source into attention drafts bound to the terminal context instead of synthesizing a generic text fact

#### Scenario: Terminal focused by another actor does not become this runtime's attention input
- **WHEN** a terminal produces a semantic change but only some other actor seat focuses it
- **THEN** terminal-system still records that focus truth
- **THEN** this session runtime does not ingest that terminal attention solely from the other actor's focus

#### Scenario: Future systems reuse the same invalidation protocol
- **WHEN** a future system such as browser-system or os-system participates in runtime orchestration
- **THEN** it registers a source namespace and invalidates protocol-native `src` addresses through the shared registry contract
- **THEN** the runtime resolves that source into structured attention drafts without adding new session-runtime private queues
