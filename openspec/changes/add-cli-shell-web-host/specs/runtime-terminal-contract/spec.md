## MODIFIED Requirements

### Requirement: Runtime terminal truth SHALL support Web-hosted cli-shell projection without creating a second authority

When cli-shell is hosted through a browser surface, runtime terminal truth SHALL still derive from the same backend terminal authority used by native hosts. Browser-hosted cli-shell interactions remain projections over that authority unless geometry authority changes explicitly.

#### Scenario: Browser-hosted cli-shell stays projection-only while native host owns geometry
- **GIVEN** a native `cli-shell` host already owns geometry for one attached backend terminal
- **WHEN** `cli-shell --web` opens another attachment to that same terminal
- **THEN** the browser host consumes shared terminal truth as a projection
- **AND** browser resize does not silently rewrite backend rows and columns

#### Scenario: Browser-hosted cli-shell shares viewport truth with other attachments
- **GIVEN** one browser-hosted cli-shell attachment and another attachment share the same backend terminal
- **WHEN** either host mutates the visible viewport through allowed interactions
- **THEN** runtime republishes the authoritative viewport result for both hosts
- **AND** neither host becomes a private viewport authority for that shared terminal
