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

#### Scenario: CLI and local API dispatch the mixed terminal input descriptor
- **WHEN** the runtime exposes `terminal input`
- **THEN** the loopback-local API route, shell CLI subcommand, and `--help` output are all derived from the same descriptor entry
- **AND** the system does not maintain a second hand-written parser or route mapping for that operation

#### Scenario: CLI and local API preserve terminal input failure truth
- **WHEN** terminal-core rejects a pending-backed `terminal write` or `terminal input` payload
- **THEN** the shared descriptor surface reports that failure truth back to the caller
- **AND** it does not synthesize a successful `written` result for input that never reached the PTY

#### Scenario: Skill config mutation uses the same descriptor contract
- **WHEN** the runtime exposes `skill set-config`
- **THEN** the loopback-local API route, shell CLI subcommand, and `--help` output are all derived from the same descriptor entry
- **AND** the runtime does not maintain a second hand-written parser for the same config payload

### Requirement: Runtime CLI SHALL accept only canonical JSON payload forms

The AI-facing shell CLI SHALL accept only canonical JSON payload forms for descriptor-backed subcommands: empty input when the schema allows `{}`, one JSON argv payload, or JSON stdin payload. When `--compact` is present, the payload source SHALL be a compact JSON array derived from the descriptor schema instead of an object JSON payload.

#### Scenario: CLI accepts a single JSON argv payload
- **WHEN** the AI runs `terminal write '{\"terminalId\":\"term-1\",\"text\":\"npm run dev\\r\"}'`
- **THEN** the CLI validates that JSON against the shared descriptor schema
- **AND** it forwards the normalized payload to the matching runtime-local API route

#### Scenario: CLI accepts a mixed terminal input payload
- **WHEN** the AI runs `terminal input '{\"terminalId\":\"term-1\",\"text\":\"npm run dev<key data=\\\"enter\\\"/>\"}'`
- **THEN** the CLI validates that JSON against the shared descriptor schema
- **AND** it forwards the normalized payload to the matching runtime-local API route

#### Scenario: CLI accepts JSON stdin for long payloads
- **WHEN** the AI calls `root_bash` with `command=\"message send\"` and a JSON `stdin` payload
- **THEN** the CLI parses stdin as the descriptor payload
- **AND** the runtime handles the same request shape as the argv form

#### Scenario: Legacy natural or positional syntax is rejected
- **WHEN** the AI runs `message send --room room-1 --content \"hello\"` or `terminal write term-1 \"npm run dev\"`
- **THEN** the shell rejects the command
- **AND** the error explicitly points the caller back to JSON payload input or `--help`

### Requirement: Runtime CLI help SHALL be generated from descriptor description and input schema

Each descriptor-backed runtime CLI subcommand SHALL expose `--help` output generated from the shared descriptor description, input schema, and canonical examples.

#### Scenario: Help reveals schema-backed terminal write raw usage
- **WHEN** the AI runs `terminal write --help`
- **THEN** the output shows the descriptor description
- **AND** it includes the JSON input schema for `terminal write`
- **AND** it includes a preferred `root_bash.command + stdin` example
- **AND** it explains that `terminal write` is raw mode without implicit submit
- **AND** any argv example is presented only as the compact form for trivially short payloads

#### Scenario: Help reveals schema-backed mixed terminal input usage
- **WHEN** the AI runs `terminal input --help`
- **THEN** the output shows the descriptor description
- **AND** it includes the JSON input schema for `terminal input`
- **AND** it points the caller to skill material for the mixed DSL, including raw literal blocks

#### Scenario: Help reveals schema-backed terminal read cursor controls
- **WHEN** the AI runs `terminal read --help`
- **THEN** the output includes the JSON input schema for `terminal read`
- **AND** it documents `remark` as the read cursor consumption control
- **AND** it documents `recordActivity` as the independent activity history control
- **AND** the help returns locally without invoking a runtime-local API request

#### Scenario: Help probes return locally without invoking business actions
- **WHEN** the AI runs commands such as `message --help` or `terminal write --help`
- **THEN** the shell returns help locally with exit code `0`
- **AND** no runtime-local API request is emitted for that help probe

### Requirement: Runtime skills SHALL teach only canonical JSON shell forms

Built-in runtime skills SHALL teach descriptor-backed CLI usage using only canonical JSON forms and help/discovery guidance.

#### Scenario: Built-in skills stop teaching natural flag forms
- **WHEN** the runtime renders built-in skill content for `agenter-message` or `agenter-terminal`
- **THEN** the examples use JSON argv or JSON stdin payloads
- **AND** the content points the model to `message send --help`, `terminal write --help`, `terminal input --help`, or `skill info` for discovery
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
- **WHEN** the AI calls `root_bash` with `command=\"message read --compact\"` and a compact JSON array in `stdin`
- **THEN** the CLI decodes the compact array through the same descriptor-derived positional schema
- **AND** the runtime handles the same request shape as the standard object-JSON form

### Requirement: Runtime CLI compact codec SHALL follow one schema-derived recursive law

The compact positional encoding SHALL be derived from the descriptor schema and SHALL use one recursive law for fixed objects, arrays, records, enums, and discriminated unions.

#### Scenario: Optional fields preserve position with omission and null holes
- **WHEN** a compact payload skips only trailing optional fields
- **THEN** those trailing positions may be omitted
- **AND** if a later field is still present, the skipped interior optional field is represented as `null`

#### Scenario: Terminal read compact positions preserve existing activity control
- **WHEN** a compact `terminal read` payload uses `[terminalId, mode, false]`
- **THEN** the third position continues to decode as `recordActivity = false`
- **AND** newly added cursor controls do not reinterpret that legacy compact payload as `remark = false`

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

#### Scenario: Attention commit help omits hidden room routing schema
- **WHEN** the AI runs `attention commit --help`
- **THEN** the generated schema omits any hidden room-message routing field
- **AND** the help no longer suggests that attention commit itself can send a visible room reply

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

### Requirement: Descriptor-backed message tools SHALL expose ref-aware revision workflow

Descriptor-backed message tools SHALL expose the reply-reference contract and the post-send revision workflow explicitly. `message send` SHALL accept optional same-room `ref`, `message read` SHALL return direct referenced room messages as sidecar context, and help or skill guidance SHALL describe when the caller must reread room context before edit or recall.

#### Scenario: Message send help teaches post-send revision workflow
- **WHEN** the runtime renders `message send --help`
- **THEN** the generated help explains that successful send returns `recentMessages`
- **AND** it instructs the caller to inspect recent room context with `message read` before using `message edit` or `message recall` on a suspected accidental duplicate

#### Scenario: Message read help exposes referencedItems
- **WHEN** the runtime renders `message read --help`
- **THEN** the generated help states that direct referenced room messages are returned as `referencedItems`
- **AND** the help does not describe those references as runtime cycle anchors

#### Scenario: Attention commit help omits hidden room routing schema
- **WHEN** the runtime renders `attention commit --help`
- **THEN** the generated schema omits any hidden room-message routing field
- **AND** room-visible behavior is directed through message tools instead

### Requirement: Runtime terminal descriptors SHALL expose explicit lifecycle verbs

Descriptor-backed runtime terminal CLI and loopback-local API routes SHALL expose lifecycle control using explicit `bootstrap` and `stop` verbs that match the terminal truth model, instead of keeping legacy `kill` wording as the canonical public lifecycle action.

#### Scenario: Runtime terminal bootstrap is explicit

- **WHEN** the AI runs `terminal bootstrap` for a runtime-visible terminal whose `processPhase` is `not_started` or `stopped`
- **THEN** the shared descriptor registry validates and dispatches that lifecycle request through the runtime-local API
- **AND** the PTY only starts because of that explicit bootstrap command

#### Scenario: Runtime terminal stop preserves lifecycle truth

- **WHEN** the AI runs `terminal stop` for a running runtime-visible terminal
- **THEN** the shared descriptor registry validates and dispatches that lifecycle request through the runtime-local API
- **AND** the command stops the PTY without implying that the terminal durable identity was deleted

### Requirement: Runtime terminal descriptors SHALL expose lifecycle-aware status inspection

Descriptor-backed runtime terminal CLI SHALL present `terminal list` as the canonical shell-facing status inspection surface for runtime terminal lifecycle and observed identity facts.

#### Scenario: Terminal list returns lifecycle and observed identity facts

- **WHEN** the AI runs `terminal list`
- **THEN** the returned terminal projection includes fields such as `processPhase`, `currentPath`, `currentTitle`, and stop facts
- **AND** callers do not need to infer lifecycle only from raw `terminal read` output

### Requirement: Runtime terminal descriptors SHALL expose transition-aware config commands

Descriptor-backed runtime terminal CLI and loopback-local API routes SHALL expose `terminal get-config` and `terminal set-config` for durable terminal launch/config truth.

#### Scenario: Terminal get-config is descriptor-backed

- **WHEN** the AI runs `terminal get-config`
- **THEN** the loopback-local API route, shell CLI subcommand, and `--help` output are all derived from the same descriptor entry
- **AND** the command returns durable terminal config truth instead of forcing callers to inspect unrelated files or internal DB state

#### Scenario: Terminal set-config is descriptor-backed

- **WHEN** the AI runs `terminal set-config`
- **THEN** the loopback-local API route, shell CLI subcommand, and `--help` output are all derived from the same descriptor entry
- **AND** the runtime does not maintain a second hand-written parser or mutation surface for the same payload

### Requirement: Runtime terminal help SHALL teach create auto-bootstrap plus transition wait law

Terminal CLI help SHALL describe the current terminal lifecycle contract precisely.

#### Scenario: Help teaches create auto-bootstrap

- **WHEN** the AI runs `terminal create --help`
- **THEN** the help text explains that public create auto-bootstraps by default
- **AND** callers understand that a brand new terminal does not normally require a second explicit bootstrap command

#### Scenario: Help teaches transition wait behavior

- **WHEN** the AI runs `terminal bootstrap --help`, `terminal stop --help`, or `terminal set-config --help`
- **THEN** the help text explains that `lifecycleTransition = bootstrapping | killing` means a lifecycle mutation is already in flight
- **AND** callers are told to reread terminal status instead of stacking another conflicting lifecycle mutation
