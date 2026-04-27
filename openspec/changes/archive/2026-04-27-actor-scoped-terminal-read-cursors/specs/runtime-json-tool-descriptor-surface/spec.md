## MODIFIED Requirements

### Requirement: Runtime CLI help SHALL be generated from descriptor description and input schema

Each descriptor-backed runtime CLI subcommand SHALL expose `--help` output generated from the shared descriptor description, input schema, and canonical examples.

#### Scenario: Help reveals schema-backed terminal read cursor controls

- **WHEN** the AI runs `terminal read --help`
- **THEN** the output includes the JSON input schema for `terminal read`
- **AND** it documents `remark` as the read cursor consumption control
- **AND** it documents `recordActivity` as the independent activity history control
- **AND** the help returns locally without invoking a runtime-local API request

### Requirement: Runtime CLI compact codec SHALL follow one schema-derived recursive law

The compact positional encoding SHALL be derived from the descriptor schema and SHALL use one recursive law for fixed objects, arrays, records, enums, and discriminated unions.

#### Scenario: Terminal read compact positions preserve existing activity control

- **WHEN** a compact `terminal read` payload uses `[terminalId, mode, false]`
- **THEN** the third position continues to decode as `recordActivity = false`
- **AND** newly added cursor controls do not reinterpret that legacy compact payload as `remark = false`
