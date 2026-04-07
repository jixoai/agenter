## ADDED Requirements

### Requirement: Compact running-avatar navigation SHALL stay attached to the persistent left rail
Compact layouts SHALL keep running-avatar secondary navigation attached to the same persistent left rail as the primary `Avatars` entry. The compact shell SHALL NOT move that navigation behind a hidden drawer.

#### Scenario: Compact Avatars shell keeps secondary navigation in the docked rail
- **WHEN** the operator is inside `Avatars` on a compact viewport and one or more avatars are running
- **THEN** the left rail remains visible as the shared navigation shell
- **THEN** expanding the `Avatars` branch reveals the running-avatar secondary navigation without opening a separate drawer
