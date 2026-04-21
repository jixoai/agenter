# runtime-json-tool-descriptor-surface Specification

## Purpose
Define the shared descriptor registry that drives runtime-local API routes, shell CLI parsing, and schema-backed help for runtime commands.
## Requirements
### Requirement: Runtime SHALL define shell/API tool surfaces from a shared descriptor registry
The runtime SHALL define `attention`, `message`, `workspace`, `terminal`, and descriptor-backed `skill` shell/API operations from one shared descriptor registry that owns command name, description, input schema, route, and execution mapping.

#### Scenario: CLI and local API dispatch the same descriptor
- **WHEN** the runtime exposes `terminal write`
- **THEN** the loopback-local API route, shell CLI subcommand, and `--help` output are all derived from the same descriptor entry
- **AND** the system does not maintain a second hand-written parser or route mapping for that operation

#### Scenario: Skill config mutation uses the same descriptor contract
- **WHEN** the runtime exposes `skill set-config`
- **THEN** the loopback-local API route, shell CLI subcommand, and `--help` output are all derived from the same descriptor entry
- **AND** the runtime does not maintain a second hand-written parser for the same config payload

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
- **AND** the content points the model to `message send --help`, `terminal write --help`, or `skill info` for discovery
- **AND** it does not teach `--room`, `--content`, `--input`, or positional payload syntax as valid command forms

### Requirement: Runtime CLI SHALL preserve UTF-8 JSON payload fidelity
The AI-facing shell CLI SHALL preserve UTF-8 content for descriptor-backed JSON payloads even when shell transport round-trips would otherwise leave the incoming JSON text in a likely mojibake form before decode.

#### Scenario: CLI repairs likely shell-induced mojibake before JSON decode
- **WHEN** the runtime receives a descriptor-backed JSON payload whose original text parses only as Latin-1-looking mojibake but a conservative UTF-8 repair yields valid JSON with recovered non-Latin-1 text
- **THEN** the CLI parses the repaired JSON payload
- **AND** the forwarded descriptor request preserves the recovered UTF-8 content

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

### Requirement: Message descriptors SHALL expose explicit reference-aware room context
Descriptor-backed message tools SHALL expose the reply-reference contract and the post-send revision workflow explicitly. `message send` SHALL accept optional same-room `ref`, `message read` SHALL return direct referenced room messages as sidecar context, and help or skill guidance SHALL describe when the caller must reread room context before edit or recall.

#### Scenario: Message send help teaches post-send revision workflow
- **WHEN** the AI runs `message send --help`
- **THEN** the help text explains that the command returns recent room summaries after send
- **AND** it instructs the caller to inspect recent room context with `message read` before using `message edit` or `message recall` on a suspected accidental duplicate

#### Scenario: Message read returns one-hop referenced room context
- **WHEN** the AI runs `message read` for a room window containing messages with direct `ref` links
- **THEN** the result includes the requested timeline `items`
- **AND** it includes a separate `referencedItems` collection for the direct referenced room messages needed to understand that window's context

#### Scenario: Built-in message skill teaches revision-aware room behavior
- **WHEN** the runtime renders the built-in message skill
- **THEN** the guidance describes send, edit, and recall as explicit room actions
- **AND** it teaches the caller to use `message read` when room context or direct refs may change the revision decision

### Requirement: Attention commit descriptor SHALL not expose room-message routing fields
The descriptor-backed `attention commit` command SHALL keep attention payloads internal. Its public schema and generated help MUST NOT expose room-message routing fields such as `message_reply`, `chatId`, or room-level reply-reference routing.

#### Scenario: Attention commit help omits room egress schema
- **WHEN** the AI runs `attention commit --help`
- **THEN** the generated schema omits any room-message egress field
- **AND** the help no longer suggests that attention commit itself can send a visible room reply
