# superadmin-onboarding Specification

## Purpose
Define the first-run bootstrap flow that discovers, generates, or reveals root auth key material and binds a superadmin session before global admin UX proceeds.

## Requirements

### Requirement: Startup without a valid auth session SHALL enter explicit superadmin onboarding

When the application has no valid stored auth session, the client SHALL enter a dedicated onboarding flow instead of silently presenting the normal admin workbench as if bootstrap were already complete.

#### Scenario: Fresh client enters onboarding
- **WHEN** the client connects successfully but has no valid stored auth session token
- **THEN** the app shows the superadmin onboarding flow
- **THEN** global room and terminal administration actions do not become the default primary path until onboarding succeeds

#### Scenario: Invalid stored token still enters onboarding
- **WHEN** the client restores a stored auth token and the backend rejects it as expired or invalid
- **THEN** the stale token is cleared
- **THEN** the app enters the same onboarding flow instead of remaining in a broken half-authenticated state

### Requirement: Onboarding SHALL support both import and backend generation/reveal

The onboarding flow SHALL support binding an existing private key and an explicit backend call that generates or reveals the backend-managed root private key, then fills the local input for the user.

#### Scenario: User imports an existing root private key
- **WHEN** the user pastes a valid root private key into onboarding
- **THEN** the app can request a challenge, sign it, and bind a superadmin auth session
- **THEN** onboarding exits into the normal workbench

#### Scenario: User requests backend-generated root key
- **WHEN** the user clicks the onboarding action to generate or reveal the backend-managed root key
- **THEN** the frontend calls the backend bootstrap action
- **THEN** the returned root private key is filled into the local input so the user can immediately bind the superadmin session

### Requirement: Onboarding SHALL disclose root-auth bootstrap state

The bootstrap contract SHALL disclose whether the backend is using a generated local root key or an externally managed auth authority, without forcing the client to guess.

#### Scenario: Local child auth authority reports managed root key state
- **WHEN** app-server is backed by its child profile-service runtime
- **THEN** onboarding can query whether a backend-managed root key already exists
- **THEN** the UI can explain whether the next action will generate a new key or reveal the existing one

#### Scenario: External auth authority disables local root-key generation
- **WHEN** app-server is configured against an external auth authority that does not allow local key generation or reveal
- **THEN** onboarding reports that limitation explicitly
- **THEN** the user is guided toward import or the external bootstrap path instead of a broken generate button
