## ADDED Requirements

### Requirement: Message-system SHALL have explicit instance identity and a default local singleton
Each message-system instance SHALL have a stable `systemId`. The local default message-system SHALL be a singleton bound 1:1 to the current superadmin.

#### Scenario: Default local message-system resolves one stable systemId
- **GIVEN** the current superadmin environment
- **WHEN** the default local message-system starts
- **THEN** it resolves one stable local `systemId`
- **AND** in this version that `systemId` is the superadmin address
- **AND** that `systemId` is reused across restarts for the same superadmin root

### Requirement: Message-system SHALL support multiple Contacts without collapsing Contact identity into system identity
One message-system instance SHALL be able to serve multiple registered Contacts/keys while still keeping one stable instance-level `systemId`.

#### Scenario: Multiple Contacts use the same system instance
- **GIVEN** one message-system instance with one stable `systemId`
- **AND** two registered Contacts with different keys
- **WHEN** both Contacts use that message-system to join or send in rooms
- **THEN** room-management truth records the producing `systemId`
- **AND** Contact identity remains distinct from system identity

### Requirement: Additional local message-system instances SHALL be explicitly keyed
The system SHALL support creating additional local message-system instances from supplied keys, and each resulting instance SHALL get its own stable `systemId`.

#### Scenario: Keyed local message-system creation yields a distinct systemId
- **WHEN** the operator creates a second local message-system instance from an explicit key
- **THEN** that instance gets a distinct `systemId`
- **AND** it can participate in the same room-management backend without overwriting the default local singleton identity
