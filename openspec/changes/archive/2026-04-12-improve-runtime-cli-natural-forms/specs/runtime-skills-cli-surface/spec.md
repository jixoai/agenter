## ADDED Requirements

### Requirement: Runtime shell CLI SHALL accept natural flag forms for high-frequency room workflows
The AI-facing shell commands exposed inside `root_workspace_bash` SHALL accept common named-flag equivalents for room read/send flows, while still preserving the canonical positional syntax.

#### Scenario: message send accepts room/content flags without polluting the visible payload
- **WHEN** the AI runs `message send --room <chatId> --content "APP-ACK: started"`
- **THEN** the shell normalizes the command into the same runtime-local payload as `message send <chatId> "APP-ACK: started"`
- **AND** the sent room content is exactly `APP-ACK: started`, not a prefixed artifact like `--content APP-ACK: started`

#### Scenario: message read accepts explicit limit flags
- **WHEN** the AI runs `message read --room <chatId> --limit 10`
- **THEN** the shell normalizes the request into the same runtime-local payload shape as the canonical positional form
- **AND** the runtime receives `chatId=<chatId>` and `limit=10`

### Requirement: Runtime shell CLI SHALL accept natural flag forms for terminal write flows
The AI-facing `terminal write` shell command SHALL accept named text flags that map to the same runtime-local write payload as the canonical positional syntax.

#### Scenario: terminal write accepts input text flags
- **WHEN** the AI runs `terminal write <terminalId> --input "npm run dev" --submit`
- **THEN** the shell normalizes the command into the same runtime-local payload as `terminal write <terminalId> "npm run dev" --submit`
- **AND** the runtime receives the intended `text` content instead of sending `--input` into the terminal itself

### Requirement: Runtime shell CLI SHALL expose minimal subcommand help without invoking business actions
The AI-facing shell surface SHALL short-circuit common `--help` probes so the model can recover syntax without misrouting help flags into real runtime actions.

#### Scenario: message and terminal help return usage locally
- **WHEN** the AI runs commands such as `message send --help` or `terminal write --help`
- **THEN** the shell returns a minimal usage guide with exit code `0`
- **AND** no runtime-local API request is emitted for that help probe
