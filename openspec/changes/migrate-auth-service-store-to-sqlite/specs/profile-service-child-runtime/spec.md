## MODIFIED Requirements

### Requirement: Auth-service storage defaults SHALL avoid duplicate durable authorities

New auth-service child runtimes SHALL default to an auth-service storage root and a canonical SQLite store file. The runtime SHALL target exactly one writable auth-service authority root and SHALL NOT reopen an older DuckDB file as a second runtime store.

#### Scenario: Fresh runtime uses auth-service SQLite storage
- **WHEN** app-server starts a fresh local auth-service child runtime
- **THEN** the default data directory is under an auth-service-named path
- **AND** the canonical database filename is `auth-service.sqlite`
