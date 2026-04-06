## MODIFIED Requirements

### Requirement: The platform SHALL expose system-first navigation

The top-level WebUI shell SHALL expose only `Avatars`, `Messages`, and `Terminals` as primary destinations. The shell SHALL expose `/admin` only through the footer superadmin affordance, and auth/bootstrap helper state SHALL NOT render as an extra primary navigation item or footer card that competes with those three destinations.

#### Scenario: Primary shell excludes auth bootstrap cards
- **WHEN** the operator opens the WebUI without an authenticated profile bootstrap
- **THEN** the left shell still shows only `Avatars`, `Messages`, and `Terminals` as primary destinations
- **AND** auth/bootstrap helper state does not appear as a fourth navigation card inside the main shell surface
