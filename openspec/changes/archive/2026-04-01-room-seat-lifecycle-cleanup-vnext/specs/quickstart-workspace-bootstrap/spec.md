## MODIFIED Requirements

### Requirement: Quick Start room bootstrap SHALL persist seat membership without legacy identity roles

Quick Start room bootstrap settings SHALL persist participant ids and optional labels, and SHALL stop emitting deprecated `avatar|user|system` identity-role markers.

#### Scenario: Saving quickstart room config strips legacy participant roles
- **WHEN** the user saves Quick Start room config
- **THEN** the stored participant list keeps seat ids and optional labels
- **AND** deprecated identity-role fields are omitted from the normalized write
