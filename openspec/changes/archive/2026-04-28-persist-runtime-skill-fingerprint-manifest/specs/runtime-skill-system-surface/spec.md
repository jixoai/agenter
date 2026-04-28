## MODIFIED Requirements

### Requirement: Watcher events SHALL flush at the next collection boundary

Watcher events SHALL be treated as dirtiness hints only. The runtime SHALL recompute skill truth from disk and publish aggregated reminders per changed skill at the next model input collection boundary, with an idle debounce fallback if no other input arrives first. When the runtime process was absent and no watcher could observe the edit, refresh SHALL compare current skill truth with the session-local fingerprint manifest.

#### Scenario: Missing fingerprint manifest initializes a baseline

- **GIVEN** a runtime session has visible skills but no persisted skill fingerprint manifest
- **WHEN** the runtime skill system refreshes with reminder publication enabled
- **THEN** it writes the current skill fingerprints as the baseline
- **AND** it does not emit added reminders for every existing skill

#### Scenario: Stopped-runtime skill edit emits a reminder on restart

- **GIVEN** a runtime session has already written a skill fingerprint manifest
- **AND** one observed skill file changes while the runtime process is stopped
- **WHEN** the same session starts and refreshes runtime skills
- **THEN** the runtime emits one aggregated updated-skill reminder
- **AND** the manifest is advanced so a later restart without further edits emits no duplicate reminder

#### Scenario: Corrupt fingerprint manifest repairs without noisy reminders

- **GIVEN** a runtime session has an unreadable or incompatible skill fingerprint manifest
- **WHEN** the runtime skill system refreshes
- **THEN** it replaces the manifest with the current skill fingerprints
- **AND** it does not infer broad skill-change reminders from the corrupt baseline
