# workspace-devtools-surface Specification

## Purpose
Define the durable boundary between the simplified Avatar runtime shell and future deeper technical tooling.

## Requirements

### Requirement: Workspace Devtools SHALL own technical session inspection
The WebUI SHALL stop flattening deep technical inspection into the primary Avatar detail tab set. Avatar detail SHALL reserve its primary tabs for `Heartbeat`, `Attention`, and `Settings`, while deeper technical tooling is entered through secondary links or future dedicated surfaces.

#### Scenario: Primary runtime tabs stay focused on heartbeat and attention
- **WHEN** the user opens a running-avatar detail shell
- **THEN** the primary tab strip exposes `Heartbeat`, `Attention`, and `Settings`
- **AND** the user does not have to navigate across `Cycles` or telemetry tabs before reaching the runtime's main working surfaces

#### Scenario: Deep technical tooling is no longer a first-class peer tab
- **WHEN** the operator needs low-level telemetry or similar future tooling
- **THEN** the runtime shell links to a secondary or future dedicated inspection surface
- **AND** the primary Avatar detail shell remains focused on runtime work rather than an always-expanded devtools dashboard
