# runtime-json-tool-descriptor-surface Specification

## Purpose
Define the shared descriptor registry that drives runtime-local API routes, shell CLI parsing, and schema-backed help for runtime commands.
## Requirements
### Requirement: Runtime SHALL define shell/API tool surfaces from a shared descriptor registry
The runtime SHALL define `attention`, `message`, `workspace`, and `terminal` shell/API operations from one shared descriptor registry that owns command name, description, input schema, route, and execution mapping.

#### Scenario: CLI and local API dispatch the same descriptor
- **WHEN** the runtime exposes `terminal write`
- **THEN** the loopback-local API route, shell CLI subcommand, and `--help` output are all derived from the same descriptor entry
- **AND** the system does not maintain a second hand-written parser or route mapping for that operation

### Requirement: Runtime CLI SHALL accept only canonical JSON payload forms
The AI-facing shell CLI SHALL accept only canonical JSON payload forms for descriptor-backed subcommands: empty input when the schema allows `{}`, one JSON argv payload, or JSON stdin payload.

#### Scenario: CLI accepts a single JSON argv payload
- **WHEN** the AI runs `terminal write '{"terminalId":"term-1","text":"npm run dev","submit":true}'`
- **THEN** the CLI validates that JSON against the shared descriptor schema
- **AND** it forwards the normalized payload to the matching runtime-local API route

#### Scenario: CLI accepts JSON stdin for long payloads
- **WHEN** the AI calls `root_workspace_bash` with `command="message send"` and a JSON `stdin` payload
- **THEN** the CLI parses stdin as the descriptor payload
- **AND** the runtime handles the same request shape as the argv form

#### Scenario: Legacy natural or positional syntax is rejected
- **WHEN** the AI runs `message send --room room-1 --content "hello"` or `terminal write term-1 "npm run dev"`
- **THEN** the shell rejects the command
- **AND** the error explicitly points the caller back to JSON payload input or `--help`

### Requirement: Runtime CLI help SHALL be generated from descriptor description and input schema
Each descriptor-backed runtime CLI subcommand SHALL expose `--help` output generated from the shared descriptor description, input schema, and canonical examples.

#### Scenario: Help reveals schema-backed terminal write usage
- **WHEN** the AI runs `terminal write --help`
- **THEN** the output shows the descriptor description
- **AND** it includes the JSON input schema for `terminal write`
- **AND** it includes a preferred `root_workspace_bash.command + stdin` example
- **AND** any argv example is presented only as the compact form for trivially short payloads

#### Scenario: Help probes return locally without invoking business actions
- **WHEN** the AI runs commands such as `message --help` or `terminal write --help`
- **THEN** the shell returns help locally with exit code `0`
- **AND** no runtime-local API request is emitted for that help probe

### Requirement: Runtime skills SHALL teach only canonical JSON shell forms
Built-in runtime skills SHALL teach descriptor-backed CLI usage using only canonical JSON forms and help/discovery guidance.

#### Scenario: Built-in skills stop teaching natural flag forms
- **WHEN** the runtime renders built-in skill content for `agenter-message` or `agenter-terminal`
- **THEN** the examples use JSON argv or JSON stdin payloads
- **AND** the content points the model to `message send --help`, `terminal write --help`, or `ccski info` for discovery
- **AND** it does not teach `--room`, `--content`, `--input`, or positional payload syntax as valid command forms

### Requirement: Runtime CLI SHALL preserve UTF-8 JSON payload fidelity
The AI-facing shell CLI SHALL preserve UTF-8 content for descriptor-backed JSON payloads even when shell transport round-trips would otherwise leave the incoming JSON text in a likely mojibake form before decode.

#### Scenario: CLI repairs likely shell-induced mojibake before JSON decode
- **WHEN** the runtime receives a descriptor-backed JSON payload whose original text parses only as Latin-1-looking mojibake but a conservative UTF-8 repair yields valid JSON with recovered non-Latin-1 text
- **THEN** the CLI parses the repaired JSON payload
- **AND** the forwarded descriptor request preserves the recovered UTF-8 content

