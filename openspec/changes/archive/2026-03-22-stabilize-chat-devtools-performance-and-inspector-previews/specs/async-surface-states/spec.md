## MODIFIED Requirements

### Requirement: WebUI surfaces SHALL model loading and emptiness independently
The WebUI SHALL treat content availability and loading activity as separate state dimensions and MUST expose them through an explicit four-state async surface contract: `empty-loading`, `empty-idle`, `ready-loading`, and `ready-idle`.

#### Scenario: Empty surface shows loading treatment while fetching
- **WHEN** a surface has no data yet and a fetch is in progress
- **THEN** the UI renders a loading treatment instead of idle empty-state copy
- **THEN** the surface state is represented as `empty-loading`
- **THEN** the surface may show explicit loading copy when no existing data is available yet

#### Scenario: Empty surface shows idle empty-state copy
- **WHEN** a surface has no data and no fetch is in progress
- **THEN** the UI renders the idle empty-state treatment
- **THEN** the surface state is represented as `empty-idle`

#### Scenario: Populated surface stays visible while refreshing
- **WHEN** a surface already has data and a refresh is in progress
- **THEN** the existing data remains visible and the UI adds a non-destructive loading affordance on top of it
- **THEN** the surface state is represented as `ready-loading`

#### Scenario: Populated surface stays idle without overlay
- **WHEN** a surface already has data and no refresh is in progress
- **THEN** the existing data remains visible without a loading overlay
- **THEN** the surface state is represented as `ready-idle`
