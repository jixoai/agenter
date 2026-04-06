# principal-identity-core Specification

## Purpose
Define the canonical principal-key identity law for durable entities so auth identities, managed resources, and avatar-owned runtime identities all share the same raw `0x...` address model.

## Requirements

### Requirement: Durable identities SHALL be principal ids

All new durable identities created by the platform SHALL use lowercase raw `0x...` addresses as their canonical ids.

#### Scenario: New auth challenge uses raw principal id
- **WHEN** a browser signs in with an EVM private key
- **THEN** the auth challenge and resulting auth session use the wallet address itself as `authId`
- **AND** the platform does not prepend `wallet_evm:` or `auth:` to the durable id

### Requirement: Managed resources SHALL be able to own managed principals

The platform SHALL be able to generate and persist managed principals for resources like rooms.

#### Scenario: New room principal is created
- **WHEN** the platform creates a managed room principal
- **THEN** it persists a principal record with kind `room`
- **AND** it stores the room private key encrypted at rest
- **AND** the returned room id is the room principal id

### Requirement: Avatars SHALL own local principals

Each avatar SHALL persist a durable principal keypair in its own local settings file.

#### Scenario: Avatar settings are initialized
- **WHEN** a session starts with an avatar that has no principal yet
- **THEN** the avatar settings file gains a principal id, public key, and private key
- **AND** subsequent sessions for that avatar reuse the same principal
