# runtime-terminal-activity-bridge Specification

## Purpose

Define the durable boundary between terminal physical activity, passive observation history, and explicit runtime-loop ingress.

## Requirements

### Requirement: Runtime terminal activity bridge SHALL classify terminal changes before loop ingress

The runtime SHALL route terminal physical changes through a dedicated terminal activity bridge before those changes become runtime-loop ingress. The bridge SHALL classify each terminal change as either passive observation or actionable ingress.

#### Scenario: Passive terminal change stays terminal-owned first
- **WHEN** a focused shared terminal emits ordinary snapshot or diff changes without any explicit action predicate
- **THEN** the bridge records that terminal change as passive observation
- **AND** the runtime does not immediately create loop ingress solely because the terminal changed

#### Scenario: Actionable terminal change upgrades to ingress
- **WHEN** a terminal change matches an explicit bridge action predicate such as lifecycle mutation, await satisfaction, approval-needed, or delivery-verification-needed
- **THEN** the bridge emits runtime ingress for that terminal change
- **AND** the emitted ingress carries an explicit actionability reason instead of relying on implicit scheduler wake-up

### Requirement: Runtime terminal activity bridge SHALL publish one wake decision per terminal change

The terminal activity bridge SHALL own the final runtime wake decision for terminal-originated work. Physical terminal changes MAY be observed through low-level wait or dirty primitives, but only the bridge SHALL decide whether the runtime loop is signaled.

#### Scenario: Bridge suppresses duplicate wake paths
- **WHEN** one terminal change is observed by both a dirty marker path and a low-level wait primitive
- **THEN** the bridge resolves that observation into at most one runtime wake decision
- **AND** the runtime does not treat the same terminal change as two separate loop wake causes

#### Scenario: Passive observation does not emit terminal wake signal
- **WHEN** the bridge classifies a terminal change as passive observation
- **THEN** it does not emit a runtime terminal wake signal for that change
- **AND** terminal activity remains queryable through terminal-owned truth without forcing model work

### Requirement: Runtime terminal activity bridge SHALL keep actionability taxonomy explicit

The bridge SHALL expose explicit named reasons for actionable terminal ingress rather than relying on ad-hoc boolean flags or source-specific scheduler shortcuts.

#### Scenario: Actionable ingress records named reason
- **WHEN** the bridge upgrades a terminal change into runtime ingress
- **THEN** the resulting ingress metadata includes a named actionability reason
- **AND** operators and tests can explain why that terminal change became runtime work

#### Scenario: Passive observation remains reasoned but non-actionable
- **WHEN** a terminal change is preserved only as passive history
- **THEN** the bridge MAY record why it remained passive
- **AND** that explanation does not itself convert the observation into runtime ingress
