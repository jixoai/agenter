# runtime-skills-cli-surface Specification

## MODIFIED Requirements

### Requirement: Root workspace bash SHALL expose runtime CLI commands in-shell
The shell environment behind `root_workspace_bash` SHALL provide CLI commands for `attention`, `message`, `workspace`, `terminal`, `ccski`, and `tool`.

#### Scenario: Shell exposes CLI commands as normal command names
- **WHEN** the AI runs `which attention`, `which workspace`, or `which ccski` inside `root_workspace_bash`
- **THEN** each command is discoverable and executable from that shell session
- **AND** each command obeys the same mount and credential boundaries as the runtime

#### Scenario: Attention commit accepts shell-friendly settle flags
- **WHEN** the AI runs `attention commit --context ctx-chat-main --summary "done" --score 0`
- **THEN** the runtime accepts the command without requiring JSON heredoc syntax
- **AND** the command is normalized into the same runtime-local attention commit payload shape as JSON input

### Requirement: Runtime CLI SHALL accept shell stdin for long-form shell workflows
The `message`, `terminal`, and `attention commit` CLI commands exposed inside `root_workspace_bash` SHALL accept stdin payloads when the content is more natural to stream than to escape into argv.

#### Scenario: Attention commit still accepts JSON stdin for full payload control
- **WHEN** the AI runs `cat <<'EOF' | attention commit ... EOF` with a JSON payload on stdin
- **THEN** the runtime parses the JSON payload exactly
- **AND** flag-form ergonomics do not remove the full JSON escape hatch

### Requirement: Runtime-local attention commit SHALL preserve done semantics across tool surfaces
When a runtime-local attention commit request marks a context as done without explicit score overrides, the runtime SHALL resolve that context's current active score keys to zero before persisting the commit.

#### Scenario: Done resolves active scores even through CLI/API
- **GIVEN** context `ctx-chat-main` currently has unresolved attention scores
- **WHEN** the runtime-local API receives an `attention commit` request with `contextId=ctx-chat-main`, `done=true`, and no explicit `scores`
- **THEN** the persisted commit sets each active score key in that context to `0`
- **AND** the context is no longer returned as active attention work
