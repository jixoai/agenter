## ADDED Requirements

### Requirement: Runtime CLI SHALL support an explicit compact positional encoding
Descriptor-backed runtime CLI subcommands SHALL accept an explicit `--compact` mode that encodes the descriptor payload as a JSON array derived from the shared schema, then decodes it back into the same validated object payload.

#### Scenario: Compact argv decodes into the same descriptor payload
- **WHEN** the AI runs `terminal kill --compact '[\"term-1\"]'`
- **THEN** the CLI decodes that compact array through the descriptor-derived positional schema
- **AND** it forwards the same normalized object payload as the standard object-JSON form

#### Scenario: Compact stdin decodes into the same descriptor payload
- **WHEN** the AI calls `root_workspace_bash` with `command=\"message read --compact\"` and a compact JSON array in `stdin`
- **THEN** the CLI decodes the compact array through the same descriptor-derived positional schema
- **AND** the runtime handles the same request shape as the standard object-JSON form

### Requirement: Runtime CLI compact codec SHALL follow one schema-derived recursive law
The compact positional encoding SHALL be derived from the descriptor schema and SHALL use one recursive law for fixed objects, arrays, records, enums, and discriminated unions.

#### Scenario: Optional fields preserve position with omission and null holes
- **WHEN** a compact payload skips only trailing optional fields
- **THEN** those trailing positions may be omitted
- **AND** if a later field is still present, the skipped interior optional field is represented as `null`

#### Scenario: Enum fields encode by declared ordinal
- **WHEN** a compact payload contains a descriptor enum field
- **THEN** that field is encoded as the zero-based ordinal of the declared enum order
- **AND** the CLI decodes that ordinal back into the original enum value before validation

#### Scenario: Discriminated unions keep their original discriminator literal
- **WHEN** a compact payload contains a discriminated union value
- **THEN** the first element of that union array is the original discriminator literal
- **AND** the remaining elements follow the selected variant's positional layout

#### Scenario: Dynamic-key records encode as key-value entry arrays
- **WHEN** a compact payload contains a record or dynamic-key object
- **THEN** that subtree is encoded as `[[key, value], ...]`
- **AND** each record value continues to use recursive compact encoding

### Requirement: Runtime CLI help SHALL publish schema-derived compact guidance
Descriptor-backed runtime CLI `--help` output SHALL publish compact availability, a compact example, and the schema-derived index mapping needed to construct compact payloads.

#### Scenario: Help prints compact availability and index mapping
- **WHEN** the AI runs `attention commit --help`
- **THEN** the output includes a compact section derived from the same descriptor schema
- **AND** that section prints whether compact is `Suggested` or `Available`
- **AND** it prints field indexes, enum ordinal mappings, and recursive compact examples needed for the command

## MODIFIED Requirements

### Requirement: Runtime CLI SHALL accept only canonical JSON payload forms
The AI-facing shell CLI SHALL accept only canonical JSON payload forms for descriptor-backed subcommands: empty input when the schema allows `{}`, one JSON argv payload, or JSON stdin payload. When `--compact` is present, the payload source SHALL be a compact JSON array derived from the descriptor schema instead of an object JSON payload.

#### Scenario: CLI accepts a single JSON argv payload
- **WHEN** the AI runs `terminal write '{\"terminalId\":\"term-1\",\"text\":\"npm run dev\",\"submit\":true}'`
- **THEN** the CLI validates that JSON against the shared descriptor schema
- **AND** it forwards the normalized payload to the matching runtime-local API route

#### Scenario: CLI accepts JSON stdin for long payloads
- **WHEN** the AI calls `root_workspace_bash` with `command=\"message send\"` and a JSON `stdin` payload
- **THEN** the CLI parses stdin as the descriptor payload
- **AND** the runtime handles the same request shape as the argv form

#### Scenario: Legacy natural or positional syntax is rejected
- **WHEN** the AI runs `message send --room room-1 --content \"hello\"` or `terminal write term-1 \"npm run dev\"`
- **THEN** the shell rejects the command
- **AND** the error explicitly points the caller back to JSON payload input or `--help`
