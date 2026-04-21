# superadmin-onboarding Specification

## MODIFIED Requirements

### Requirement: Startup without a valid auth session SHALL enter explicit superadmin onboarding

When the application has no valid stored auth session, the client SHALL verify any stored bearer token, attempt daemon-mediated automatic login, and only then enter a dedicated onboarding flow instead of silently presenting the normal admin workbench as if bootstrap were already complete.

#### Scenario: Fresh client enters authenticated workbench through daemon auto login
- **WHEN** the client connects successfully, has no valid stored auth session token, and the daemon can complete automatic login from its machine-local root auth key
- **THEN** the app receives a valid browser auth session without manual private-key entry
- **THEN** the main authenticated workbench shell becomes the first visible operator path

#### Scenario: Fresh client enters onboarding when auto login is unavailable
- **WHEN** the client connects successfully, has no valid stored auth session token, and the daemon reports that automatic login is unavailable
- **THEN** the app shows the superadmin onboarding flow
- **THEN** global room and terminal administration actions do not become the default primary path until onboarding succeeds

#### Scenario: Invalid stored token still falls back cleanly
- **WHEN** the client restores a stored auth token and the backend rejects it as expired or invalid
- **THEN** the stale token is cleared
- **THEN** the client attempts daemon-mediated automatic login before falling back to onboarding
- **THEN** the app does not remain in a broken half-authenticated state

### Requirement: Onboarding SHALL disclose root-auth bootstrap state

The bootstrap contract SHALL disclose whether the daemon can automatically sign in the browser, whether machine-local auto-login key storage is available, and whether the backing auth authority is managed-local or external, without forcing the browser to guess.

#### Scenario: Managed local daemon reports auto-login bootstrap availability
- **WHEN** app-server is backed by its child profile-service runtime and daemon-managed local key storage is available
- **THEN** onboarding can query whether automatic login is currently available
- **THEN** the UI can explain whether the next daemon-managed action will store the auto-login key or require manual private-key input

#### Scenario: External auth authority disables daemon-managed local bootstrap
- **WHEN** app-server is configured against an external auth authority that does not allow daemon-managed local key bootstrap
- **THEN** onboarding reports that limitation explicitly
- **THEN** the user is guided toward manual private-key import or the external bootstrap path instead of a broken daemon-managed button

## REMOVED Requirements

### Requirement: Onboarding SHALL support both import and backend generation/reveal
**Reason**: Browser-facing raw managed-root-key reveal is removed from the normal control-plane contract so the browser no longer receives long-lived root private key material.
**Migration**: Use manual private-key import for immediate authentication, or invoke the daemon-managed auto-login bootstrap action that stores the local key for future automatic sign-in without revealing it to the browser.
