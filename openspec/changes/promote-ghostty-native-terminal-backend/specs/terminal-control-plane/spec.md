## MODIFIED Requirements

### Requirement: Terminal control plane SHALL expose durable config inspection and mutation

The terminal control plane SHALL preserve explicit backend selection as part of the durable config truth returned through app-server projections.

#### Scenario: App-server projections preserve control-plane backend truth

- **WHEN** app-server projects terminal create, list, get-config, or set-config results from terminal-control-plane facts
- **THEN** those projections expose the same durable `backend` value held by the control plane
- **AND** app-server does not omit `backend` from some terminal surfaces while preserving it on others
