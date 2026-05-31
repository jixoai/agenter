## ADDED Requirements

### Requirement: Backend interaction SHALL accept keyboard-driven selection ranges

Backend interaction owners SHALL accept selection ranges produced by keyboard editing gestures such as Option+Shift+Left and Option+Shift+Right when the app enables those gestures.

#### Scenario: Keyboard range selection remains backend-owned
- **WHEN** a projection host turns a keyboard selection gesture into a `selectRange` event
- **THEN** the backend interaction owner SHALL store and publish that selected range in backend coordinates
- **AND** copy SHALL read selected text from the backend owner

#### Scenario: Unsupported owner rejects range selection
- **WHEN** a `selectRange` event targets a different owner than the backend interaction controller owns
- **THEN** the backend interaction owner SHALL reject the event
- **AND** host projection SHALL NOT fabricate a fallback selected text range
