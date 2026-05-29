## ADDED Requirements

### Requirement: Terminal frame state SHALL expose per-terminal mouse tracking truth

The terminal backend SHALL expose a `TerminalMouseTrackingState` for each terminal owner. The state SHALL include a protocol of `none`, `vt200`, `drag`, or `any`, and an encoding of `default` or `sgr`. The state SHALL be derived from PTY output/control-sequence parsing in the terminal/backend layer and SHALL NOT be inferred globally by Shell-Next or any other projection host.

#### Scenario: DECSET mouse modes update backend truth

- **GIVEN** a terminal backend receives `CSI ? 1000 h`, `CSI ? 1002 h`, `CSI ? 1003 h`, or `CSI ? 1006 h`
- **WHEN** a frame or host input target reads mouse tracking state
- **THEN** the state reports the matching protocol or encoding
- **AND** `CSI ? ... l` returns the matching state back to `none` or `default`

#### Scenario: Transport preserves mouse tracking state

- **GIVEN** a terminal frame carries mouse tracking state
- **WHEN** the frame is encoded as a full frame, rows patch, scroll rows patch, or row-cache patch
- **THEN** the decoded frame preserves the same protocol and encoding

### Requirement: Backend utilities SHALL route pointer input by PTY mouse state

`@agenter/termless-backend-utils` SHALL own host pointer routing for terminal backends. When mouse tracking is active and Shift is not held, pointer down, drag, up, and wheel events SHALL be encoded as xterm mouse input bytes and written to the target PTY. When mouse tracking is inactive, the same controller SHALL use backend-owned semantic and drag selection. This routing SHALL return an explicit effect so callers can distinguish `selection`, `selection-finalized`, and `pty-mouse`.

#### Scenario: Plain shell drag selects text

- **GIVEN** the target mouse tracking state is `none`
- **WHEN** the operator presses, drags, and releases over terminal cells
- **THEN** the backend utility starts, updates, and finalizes backend selection
- **AND** the final pointer-up effect is `selection-finalized`

#### Scenario: Mouse-aware TUI receives mouse bytes

- **GIVEN** the target mouse tracking state is active
- **WHEN** the operator presses, drags, releases, or wheels over terminal cells without Shift
- **THEN** the backend utility writes encoded xterm mouse bytes to the PTY
- **AND** backend selection methods are not called
- **AND** the dispatch effect is `pty-mouse`

#### Scenario: Shift overrides PTY mouse passthrough

- **GIVEN** the target mouse tracking state is active
- **WHEN** the host still delivers a Shift pointer drag
- **THEN** the backend utility uses the selection path
- **AND** it does not write PTY mouse bytes for that event
