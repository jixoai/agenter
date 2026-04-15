## ADDED Requirements

### Requirement: Runtime guidance SHALL default descriptor-backed JSON transport to stdin
Built-in runtime skills, references, and top-level runtime prompts SHALL teach that descriptor-backed runtime-local CLI commands use a minimal `root_workspace_bash.command` plus JSON `stdin` by default, while a single argv JSON payload remains only a compact fallback for trivially short requests.

#### Scenario: Message, terminal, and attention guidance prefer stdin-first transport
- **WHEN** the runtime renders built-in guidance for `message`, `terminal`, `attention`, or the top-level runtime prompt surface
- **THEN** the examples teach `command=<bare action>` plus JSON `stdin` as the default transport
- **AND** any argv JSON example is described only as the compact fallback for trivially short payloads

## MODIFIED Requirements

### Requirement: Runtime CLI SHALL accept shell stdin for long-form shell workflows
The `message`, `terminal`, and `attention commit` CLI commands exposed inside `root_workspace_bash` SHALL accept JSON stdin payloads when the content is more natural to stream than to escape into argv.

#### Scenario: Terminal write accepts piped stdin
- **WHEN** the AI calls `root_workspace_bash` with `command="terminal write"` and a JSON `stdin` payload
- **THEN** the piped stdin becomes the validated terminal-write payload
- **AND** the runtime does not require the same JSON to be repeated inside argv

#### Scenario: Message send accepts piped stdin
- **WHEN** the AI calls `root_workspace_bash` with `command="message send"` and a JSON `stdin` payload
- **THEN** the piped stdin becomes the validated room-message payload
- **AND** the runtime preserves unix-style shell composition for multi-line message bodies

#### Scenario: Attention commit still accepts JSON stdin for full payload control
- **WHEN** the AI calls `root_workspace_bash` with `command="attention commit"` and a JSON payload in `stdin`
- **THEN** the runtime parses the JSON payload exactly
- **AND** shell tooling keeps the full JSON escape hatch for long-form settle flows
