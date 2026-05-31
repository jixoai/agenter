## ADDED Requirements

### Requirement: Termless backend utils SHALL provide opt-in backend utility composition

`@agenter/termless-backend-utils` SHALL host optional backend-adjacent utilities that products or partial backends can explicitly compose. It SHALL NOT be treated as a backend authority, backend registry, or replacement for `@agenter/termless-core`.

#### Scenario: Shell-next composes host input explicitly

- **WHEN** shell-next needs host keyboard and pointer behavior for a terminal source
- **THEN** it imports `createTerminalHostInputController` from `@agenter/termless-backend-utils`
- **AND** it composes that controller at the terminal source boundary
- **AND** `@agenter/termless-core` does not export that controller

#### Scenario: Complete backend can opt out

- **GIVEN** a future backend already owns keyboard, pointer, selection, and clipboard behavior
- **WHEN** a app consumes that backend
- **THEN** the app can avoid `@agenter/termless-backend-utils`
- **AND** no `core` behavior forces a second input policy to run

#### Scenario: Partial backend can reuse selected utilities

- **GIVEN** a backend owns normal key handling but not semantic pointer selection
- **WHEN** a app composes terminal behavior
- **THEN** it can disable keyboard utilities and enable pointer semantic selection only
- **AND** disabled utilities do not mutate backend state

### Requirement: Terminal host input utilities SHALL expose feature switches

The terminal host input controller SHALL expose switches for keyboard and pointer sub-behaviors. Disabled features SHALL fall through without writing input, clearing selection, following cursor, or changing selection state.

#### Scenario: Keyboard disabled is a no-op

- **WHEN** a controller is created with `keyboard: false`
- **AND** a key or paste event is handled
- **THEN** the controller returns `false`
- **AND** no input is written
- **AND** no selection is cleared
- **AND** follow-cursor is not requested

#### Scenario: Word navigation disabled falls through

- **WHEN** a controller is created with `keyboard.wordNavigation: false`
- **AND** Option+Left or Option+Right is handled
- **THEN** the controller does not synthesize repeated arrow bytes
- **AND** the event falls through unless another enabled keyboard utility handles it

#### Scenario: Semantic pointer selection disabled falls through

- **WHEN** a controller is created with `pointer.semanticSelection: false`
- **AND** the user double-clicks or triple-clicks terminal text
- **THEN** the controller does not call word or line selection
- **AND** the semantic click returns an unhandled pointer result

#### Scenario: Drag selection can be disabled independently

- **WHEN** a controller is created with `pointer.dragSelection: false` and `pointer.semanticSelection: true`
- **THEN** drag events do not start selection
- **AND** double-click word selection can still be handled

### Requirement: Terminal host input transaction SHALL remain configurable

The host input transaction SHALL be configurable so products can keep the current shell-next behavior while richer backends can avoid duplicate selection clearing or follow-cursor logic.

#### Scenario: Default transaction preserves shell-next behavior

- **WHEN** the default controller accepts plain terminal input
- **THEN** it clears the backend selection
- **AND** it writes the input once
- **AND** it requests follow-cursor once after the write is accepted

#### Scenario: Clear-selection on input can be disabled

- **WHEN** a controller is created with `keyboard.clearSelectionOnInput: false`
- **AND** plain terminal input is accepted
- **THEN** it writes the input
- **AND** it does not clear backend selection as part of that transaction

#### Scenario: Follow-cursor on input can be disabled

- **WHEN** a controller is created with `keyboard.followCursorOnInput: false`
- **AND** plain terminal input is accepted
- **THEN** it writes the input
- **AND** it does not request follow-cursor
