## ADDED Requirements

### Requirement: Runtime guidance SHALL expose compact mode independently per system skill
Built-in runtime skills, references, and top-level runtime prompts SHALL teach `--compact` as an optional encoding surface for descriptor-backed runtime CLI commands while keeping each system skill independently responsible for its own examples.

#### Scenario: System skills teach compact mode without centralizing skill ownership
- **WHEN** the runtime renders built-in guidance for `message`, `terminal`, `attention`, or the top-level runtime prompt surface
- **THEN** each system skill may show its own `--compact` examples and fallback hints
- **AND** the runtime does not replace those independent skill notes with one centralized compact-only skill

## MODIFIED Requirements

### Requirement: Runtime-local system CLI SHALL reserve only `--help` as the non-JSON marker
The `attention`, `message`, `workspace`, and `terminal` commands SHALL treat `--help` and `--compact` as the only reserved non-JSON argv markers. Short aliases such as `-h`, bare `help`, or `--arg=value`-style positional forms SHALL NOT become alternate parsing modes.

#### Scenario: Canonical help stays on `--help`
- **WHEN** the AI runs `message --help`
- **THEN** the runtime returns local schema-backed help without calling the runtime API
- **AND** the canonical examples stay JSON-first

#### Scenario: Compact mode is explicit
- **WHEN** the AI wants to send a compact payload such as `[0,[\"term-1\"]]`
- **THEN** it must pass `--compact`
- **AND** the runtime does not auto-detect ordinary JSON arrays as compact payloads without that marker

#### Scenario: Non-canonical help alias is rejected as ordinary argv
- **WHEN** the AI runs `message -h`
- **THEN** the runtime treats `-h` as an ordinary token instead of a help alias
- **AND** the command fails through the normal JSON-only CLI rules

### Requirement: Runtime guidance SHALL default descriptor-backed JSON transport to stdin
Built-in runtime skills, references, and top-level runtime prompts SHALL teach that descriptor-backed runtime-local CLI commands use a minimal `root_workspace_bash.command` plus JSON `stdin` by default, while a single argv JSON payload remains only a compact fallback for trivially short requests. When `--compact` is available, guidance SHALL present it as an optional encoding surface, not as a replacement for standard object JSON.

#### Scenario: Message, terminal, and attention guidance prefer stdin-first transport
- **WHEN** the runtime renders built-in guidance for `message`, `terminal`, `attention`, or the top-level runtime prompt surface
- **THEN** the examples teach `command=<bare action>` plus JSON `stdin` as the default transport
- **AND** any argv JSON example is described only as the compact fallback for trivially short payloads
- **AND** compact mode is still surfaced as available per command when the AI wants positional payloads
