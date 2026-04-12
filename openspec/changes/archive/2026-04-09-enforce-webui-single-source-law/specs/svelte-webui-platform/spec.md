## MODIFIED Requirements

### Requirement: CLI delivery SHALL serve the SvelteKit app as static SPA assets
The CLI WebUI delivery path SHALL resolve one canonical static asset root for the active `@agenter/webui` build and SHALL serve the SPA entry document, nested-route fallback document, and asset files from that same root. Derived copied assets MAY exist for packaging, but the runtime SHALL NOT silently choose between divergent asset trees.

#### Scenario: Root page request uses the canonical WebUI root
- **WHEN** `agenter web` serves `/`
- **THEN** the CLI returns the static WebUI entry document from the canonical asset root
- **THEN** the default browser entry reflects the current WebUI build instead of requiring a second manual asset sync

#### Scenario: Nested route refresh uses the same canonical root
- **WHEN** a browser refreshes a client route such as `/messages/room/room-main` or `/avatars/runtime/session-1/attention`
- **THEN** the CLI returns the SPA fallback document from that same canonical asset root instead of a 404
- **THEN** the refreshed route sees the same build that the root page uses

#### Scenario: Divergent asset roots do not silently mask a newer fix
- **GIVEN** a current WebUI build exists and a stale copied CLI asset tree also exists
- **WHEN** the operator starts `agenter web`
- **THEN** the runtime serves only the canonical asset root or fails fast with rebuild guidance
- **THEN** it does not silently serve the stale copied tree as an independent source of truth
