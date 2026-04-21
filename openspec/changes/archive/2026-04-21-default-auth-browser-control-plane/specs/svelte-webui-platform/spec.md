# svelte-webui-platform Specification

## ADDED Requirements

### Requirement: WebUI entry SHALL complete auth bootstrap before hydrating the protected workbench shell
The active Svelte WebUI SHALL treat login/bootstrap as the true browser entry flow. It SHALL verify any stored bearer token, attempt daemon-mediated automatic login, and only hydrate protected workbench data after an authenticated browser session exists. The main workbench shell SHALL NOT render as the default route surface while auth bootstrap is still unresolved or has failed.

#### Scenario: Stored token or auto login resolves before shell hydration
- **WHEN** the browser has a valid stored auth token or the daemon successfully completes automatic login
- **THEN** the controller marks auth bootstrap as authenticated before listing protected workspaces, profiles, sessions, settings, or runtime state
- **THEN** the main workbench shell renders only after that authenticated state exists

#### Scenario: Failed auth bootstrap shows login gate instead of the workbench
- **WHEN** the browser has no valid stored token and daemon-mediated automatic login is unavailable or fails
- **THEN** the WebUI shows the login/onboarding entry surface
- **THEN** the protected workbench shell does not hydrate protected data behind a visually already-entered application
