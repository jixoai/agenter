# svelte-webui-platform Specification

## Purpose
TBD - created by archiving change replatform-webui-sveltekit-foundation. Update Purpose after archive.
## Requirements
### Requirement: SvelteKit package SHALL be the active WebUI platform
The repository SHALL expose `@agenter/webui` as a SvelteKit 2 + Svelte 5 package, and the previous React implementation SHALL be retained only as an inactive reference package.

#### Scenario: Active package resolution
- **WHEN** workspace package discovery resolves `@agenter/webui`
- **THEN** it resolves to the SvelteKit package rather than the archived React package

#### Scenario: Archived React package remains available
- **WHEN** engineers need implementation reference from the previous UI
- **THEN** the React package remains available under a non-conflicting package identity

### Requirement: CLI delivery SHALL serve the SvelteKit app as static SPA assets
The CLI WebUI delivery path SHALL continue serving copied static assets, and unknown non-asset paths SHALL resolve to the SvelteKit SPA fallback page.

#### Scenario: Root page request
- **WHEN** `agenter web` serves `/`
- **THEN** the CLI returns the static WebUI entry document

#### Scenario: Nested route refresh
- **WHEN** a browser refreshes a client route such as `/messages/room-ops`
- **THEN** the CLI returns the SPA fallback document instead of a 404

### Requirement: The platform SHALL expose system-first navigation
The top-level WebUI shell SHALL organize navigation around orthogonal systems, not around the old session-first route hierarchy.

#### Scenario: Primary navigation
- **WHEN** the operator opens the WebUI
- **THEN** the primary shell exposes dedicated entry points for workspaces, message-system, terminal-system, and global settings/profile

#### Scenario: Route ownership
- **WHEN** a system surface is rendered
- **THEN** its route layout owns local navigation and state without depending on React-era shell contracts

