## ADDED Requirements

### Requirement: Runtime boot SHALL not auto-create default terminals
Runtime boot SHALL attach terminals only through explicit durable terminal attachments or explicit runtime orchestration. It MUST NOT auto-create or auto-focus terminals solely because session config contains terminal presets.

#### Scenario: Fresh runtime boot has no hidden terminal attachment
- **WHEN** a runtime starts without any previously attached terminal fact
- **THEN** runtime boot does not auto-create a terminal from preset config
- **AND** no terminal becomes focused until explicit terminal orchestration occurs

#### Scenario: Recovery boot restores explicit terminal attachments only
- **WHEN** a runtime restarts after previously attached terminals were durably recorded
- **THEN** recovery restores only those terminal references that still have valid durable attachment facts
- **AND** it does not create a brand new fallback terminal during boot

### Requirement: Dynamic terminal creation SHALL resolve cwd from explicit runtime context
When the AI uses runtime terminal tooling to create a terminal, the runtime SHALL resolve `cwd` from explicit runtime mount context or reject the request. It MUST NOT fall back to `homedir()` when `cwd` is omitted.

#### Scenario: One mounted workspace supplies implicit cwd
- **WHEN** the AI creates a terminal without providing `cwd` and the runtime has exactly one eligible mounted workspace root
- **THEN** the runtime uses that workspace root as the terminal cwd
- **AND** terminal creation remains inside explicit workspace context

#### Scenario: Missing or ambiguous workspace context rejects terminal creation
- **WHEN** the AI creates a terminal without `cwd` and the runtime has zero or multiple eligible workspace roots
- **THEN** the runtime rejects the request with a clear error explaining that explicit `cwd` or workspace mount context is required
- **AND** it does not create a terminal in the user home directory
