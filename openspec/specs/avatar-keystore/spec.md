# avatar-keystore Specification

## Purpose
Define the avatar-local keystore contract so workspace avatars keep durable principal material in their own local settings instead of borrowing runtime-only identities.

## Requirements

### Requirement: Avatar settings SHALL persist local principal material

Avatar settings SHALL store durable principal identity material in the avatar-local settings file.

#### Scenario: Avatar local settings contain principal material
- **WHEN** an avatar is initialized for a workspace
- **THEN** its `settings.local.json` includes `principalId`, `publicKey`, `privateKey`, and `algorithm`
- **AND** the stored principal id is reused for later session/runtime binding
