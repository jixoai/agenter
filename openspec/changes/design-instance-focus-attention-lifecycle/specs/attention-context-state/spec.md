## ADDED Requirements

### Requirement: Room archive SHALL mute the bound attention context

When a room instance is archived through the room-management lifecycle, the runtime/attention adapter SHALL move the bound room attention context to `muted` as a durable lifecycle consequence. This consequence belongs to the kernel lifecycle law and SHALL NOT be implemented by shell-next directly mutating AttentionSystem focus state.

#### Scenario: Archived room mutes its bound attention context

- **GIVEN** a room-backed attention context is `focused` or `background`
- **WHEN** the room-management lifecycle archives that room
- **THEN** the bound attention context is moved to `muted`
- **AND** later LoopBus scheduling treats that context according to normal muted law

#### Scenario: Built-in protected room context is not archived by product policy

- **GIVEN** a room or context is protected by built-in/default room policy
- **WHEN** shell-next reacts to a bound terminal death
- **THEN** shell-next SHALL NOT archive that protected room as a product cleanup side effect
- **AND** unrelated protected attention contexts keep their current focus state

#### Scenario: Room archive does not rewrite context summary

- **GIVEN** a room attention context contains Avatar-authored summary content
- **WHEN** the room is archived and the context focus state becomes `muted`
- **THEN** the context content and unresolved score history remain governed by normal attention commit law
- **AND** the lifecycle consequence changes focus state rather than replacing the Avatar-authored summary
