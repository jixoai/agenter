## ADDED Requirements

### Requirement: Empty prompt-window bootstrap state SHALL persist as a durable ledger fact
When a session initializes its current prompt window with zero prompt messages, the durable ledger SHALL still contain an explicit prompt-window state fact instead of relying only on `session_head.current_prompt_window_id`.

#### Scenario: Fresh session writes an empty prompt-window fact
- **WHEN** a runtime starts and initializes the current prompt window before any user or assistant prompt messages exist
- **THEN** `session.db` contains at least one `scope=prompt_window` ledger row for that prompt-window id
- **THEN** durable inspection can resolve the current prompt-window id without depending on an out-of-band convention that “missing rows means empty”

#### Scenario: Empty prompt-window restoration returns zero prompt messages
- **WHEN** durable inspection reads a prompt-window id whose only persisted row is the bootstrap state fact
- **THEN** the reconstructed prompt-window record returns `messages = []`
- **THEN** no synthetic system/user prompt message is injected into the restored prompt window

#### Scenario: Bootstrap state does not pollute request message linkage
- **WHEN** the runtime records a later AI-call that uses a prompt window previously initialized as empty
- **THEN** the AI-call request message id list excludes the bootstrap-only prompt-window state row
- **THEN** request linkage continues to point only at real prompt messages that were part of the provider-visible `messages` array
