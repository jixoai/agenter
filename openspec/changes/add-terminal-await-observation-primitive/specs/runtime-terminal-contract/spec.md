## ADDED Requirements

### Requirement: Runtime terminal await SHALL return structured bounded observation evidence

Runtime terminal await results SHALL expose the await outcome and bounded terminal evidence in a stable JSON contract. The contract SHALL include enough clean snapshot text for the AI to continue reasoning without an immediate follow-up `terminal read`, while preserving bounded output limits.

#### Scenario: Matched await returns snapshot lines and match context

- **WHEN** the AI runs `terminal await` and the configured match condition resolves
- **THEN** the runtime result includes `kind = terminal-await`, `outcome = matched`, terminal id, elapsed wait time, terminal running/status truth, and from/to snapshot cursor metadata
- **AND** the result includes bounded clean snapshot lines or tail lines
- **AND** the result includes match evidence with context lines

#### Scenario: Timeout await returns post-mortem snapshot evidence

- **WHEN** the AI runs `terminal await` with a command-level timeout and the condition does not resolve before that timeout
- **THEN** the runtime result includes `outcome = timeout`
- **AND** the result includes the last observed snapshot metadata and bounded clean lines
- **AND** the AI does not need a second read solely to understand what the terminal looked like at timeout

#### Scenario: Await line output remains bounded

- **WHEN** a terminal has more scrollback than the configured await view limit
- **THEN** the runtime await result includes only the bounded view requested by the caller or the default bounded tail
- **AND** it does not return unbounded terminal scrollback by default

### Requirement: Runtime terminal await activity recording SHALL be caller controlled

Runtime terminal await SHALL treat activity recording as an explicit observation control. The operation SHALL record durable terminal observation activity by default, and callers SHALL be able to disable that recording for pure probes.

#### Scenario: Default await records observation activity

- **WHEN** the AI runs `terminal await` without overriding activity recording
- **THEN** the runtime records a terminal observation activity event that includes await outcome metadata
- **AND** the activity event does not fabricate terminal output beyond the returned evidence

#### Scenario: Pure await probe preserves activity history

- **WHEN** the AI runs `terminal await` with activity recording disabled
- **THEN** the runtime returns the same await evidence contract
- **AND** no terminal activity event is appended for that probe
