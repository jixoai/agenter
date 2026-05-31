## MODIFIED Requirements

### Requirement: Web chat view SHALL present a conversation-first shared surface
The shared room component SHALL render one durable conversation surface with transcript, notices, and composer organized as explicit primary regions. The transcript/composer shell SHALL compose shared Svelte structural primitives from `@agenter/svelte-components` instead of maintaining a private layout law inside the package.

#### Scenario: Chat shell reuses shared Svelte layout law
- **WHEN** the shared chat package renders its transcript shell
- **THEN** it uses `Scaffold` and `ScrollView` from `@agenter/svelte-components`
- **THEN** chat-specific visuals and transport behavior remain local to `web-chat-view`
- **THEN** the package still avoids any dependency on `@agenter/webui`

#### Scenario: Transcript remains primary when optional shell regions are absent
- **WHEN** the host renders the shared chat view without an internal header or without extra helper regions
- **THEN** the transcript stretch region still occupies the dominant viewport height
- **THEN** the composer remains a secondary footer instead of forcing the transcript viewport to collapse

#### Scenario: Shared chat surface composes package-local shadcn-svelte atoms
- **WHEN** `@agenter/web-chat-view` assembles its conversation shell
- **THEN** it uses package-local `shadcn-svelte` composition for controls and surfaces
- **THEN** it still keeps the package boundary independent from `@agenter/webui` and app-local UI exports
