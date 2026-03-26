## ADDED Requirements

### Requirement: Runtime publication SHALL expose diagnostics for selector churn
The runtime client SHALL expose diagnostics metadata that lets performance tooling inspect why a hot slice is being republished.

#### Scenario: Diagnostics identify repeated selector publication
- **WHEN** a developer inspects runtime publication diagnostics for an active surface
- **THEN** the system reports publication counts for the selected slice
- **THEN** the reported diagnostics can distinguish steady-state idleness from hot republish churn

### Requirement: Heavy runtime slices SHALL stay cold when their surfaces are inactive
The runtime client SHALL avoid hydrating or republishing heavy route-local slices for surfaces that are not visible or not active.

#### Scenario: Inactive technical tabs stay cold
- **WHEN** a route exposes multiple heavy panels but only one panel is currently visible
- **THEN** inactive panels do not subscribe to or hydrate their heavy runtime slices
- **THEN** their data remains fetchable when the user explicitly activates that panel
