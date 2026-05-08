## ADDED Requirements

### Requirement: Renderer selection SHALL remain independent from backend ownership

Terminal viewport renderer selection SHALL remain independent from terminal backend ownership. Renderer adapters MUST consume backend-neutral terminal truth and MUST NOT redefine or infer backend package authority from the resolved browser renderer.

#### Scenario: Xterm renderer does not claim backend ownership

- **WHEN** the browser resolves `xterm` as the current terminal renderer
- **THEN** the renderer adapter consumes shared terminal snapshot, transport, and presentation facts
- **AND** it does not treat the resolved renderer as proof that an Agenter-private xterm backend package owns terminal backend identity

#### Scenario: Future backend change does not force a new browser renderer contract

- **WHEN** a later change swaps the runtime backend from official xterm to another official Termless backend
- **THEN** the renderer adapter contract remains stable unless browser renderer behavior itself changes
- **AND** host code does not need a new backend-specific browser renderer special case

## MODIFIED Requirements

### Requirement: Current desktop WebUI SHALL resolve auto preference to xterm

Current desktop WebUI SHALL resolve `rendererPreference = auto` to `xterm` unless the host explicitly overrides that environment policy. This renderer default SHALL be treated as a browser viewport policy, not as terminal backend ownership.

#### Scenario: Desktop auto preference selects xterm

- **WHEN** the browser host renders a terminal on the current desktop WebUI surface with `rendererPreference = auto`
- **THEN** the resolved renderer is `xterm`
- **AND** the viewport renders through the `xterm` adapter instead of defaulting to another experimental renderer

#### Scenario: Renderer default does not rename backend authority

- **WHEN** desktop WebUI keeps `rendererPreference = auto -> xterm` during this change
- **THEN** that policy does not imply that Agenter owns an `xterm` backend package
- **AND** backend authority remains with official Termless backend entrypoints
