## ADDED Requirements

### Requirement: Auth-service SHALL use SQLite as the canonical durable store

The auth-service authority SHALL persist auth identity, profile projection, typed icon assets, challenges, credentials, managed principals, and auth tokens in one canonical SQLite store. DuckDB SHALL NOT remain the runtime source of truth for these facts after the migration.

#### Scenario: Fresh auth-service runtime materializes canonical SQLite store
- **WHEN** auth-service boots with no existing durable store in its authority root
- **THEN** it creates one canonical SQLite database named `auth-service.sqlite`
- **AND** later reads and writes for auth/profile/icon facts resolve through that SQLite database

#### Scenario: Existing SQLite store is reused as the only writable authority
- **WHEN** auth-service boots and `auth-service.sqlite` already exists
- **THEN** it reuses that SQLite file as the only writable durable authority
- **AND** it does not reopen legacy DuckDB as a second write target

### Requirement: Auth-service SHALL enforce single-writer startup with an explicit authority lock

The auth-service authority SHALL protect its writable store with an explicit startup lock owned by the service itself rather than by incidental database-engine lock text. A second local runtime targeting the same authority root SHALL fail before serving traffic.

#### Scenario: Second local runtime is rejected by the authority lock
- **WHEN** one auth-service instance already owns the authority lock for a data dir
- **AND** a second instance starts against that same data dir
- **THEN** the second instance fails with guidance to reuse the existing `--auth-service-endpoint` or stop the owning process
- **AND** the failure identifies the existing owner process when that fact is available

#### Scenario: Stale authority lock is recovered
- **WHEN** auth-service finds an existing authority lock whose recorded PID is no longer alive
- **THEN** it replaces that stale lock and continues startup
- **AND** it does not require manual deletion before the next boot
