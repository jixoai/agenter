## ADDED Requirements

### Requirement: Runtime descriptors SHALL expose terminal await as a JSON-first command

The shared runtime tool descriptor registry SHALL expose `terminal await` as a descriptor-backed runtime-local API route, shell CLI subcommand, and generated help surface. The command SHALL follow canonical JSON payload rules and MUST NOT add natural positional or flag-only parsing that bypasses descriptor validation.

#### Scenario: Terminal await help exposes the schema-backed observation contract

- **WHEN** the AI runs `terminal await --help`
- **THEN** the help text is generated locally from the shared descriptor
- **AND** it includes the JSON schema for terminal id, wait options, match options, view limits, timeout, and activity recording
- **AND** no runtime-local API request is invoked for the help probe

#### Scenario: Terminal await accepts canonical JSON payloads

- **WHEN** the AI runs `terminal await` with JSON stdin, one JSON argv payload, or explicit compact positional mode
- **THEN** the CLI validates the payload through the shared descriptor schema
- **AND** the runtime-local API receives the same normalized terminal await request shape

#### Scenario: Terminal await does not change terminal read schema

- **WHEN** the runtime exposes `terminal await`
- **THEN** the existing `terminal read` descriptor remains an immediate read operation
- **AND** wait, match, and stabilization fields are not added to `terminal read` as an implicit second semantic mode

### Requirement: Runtime CLI cancellation SHALL propagate to long-running terminal await requests

The runtime-local CLI surface SHALL treat `terminal await` as a long-running command that shares cancellation with the shell process, local API request, and TerminalSystem wait resources.

#### Scenario: Shell-level timeout cancels the runtime await request

- **WHEN** an operator or AI wraps `terminal await` in a shell-level timeout and the shell sends a termination signal to the CLI process
- **THEN** the CLI propagates cancellation to the runtime-local request when transport is still available
- **AND** the runtime releases the corresponding TerminalSystem await resources even if the shell process exits before a JSON response is delivered

#### Scenario: Runtime request abort releases await resources

- **WHEN** the runtime-local API request for `terminal await` is aborted before the await condition resolves
- **THEN** the handler cancels the control-plane await operation
- **AND** the handler does not leave server-side timers, waiters, or listeners alive after the request is gone
