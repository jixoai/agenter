## ADDED Requirements

### Requirement: Channel error-message send SHALL require admin access
Sending an `error` message row MUST require `admin` token access for that chat channel.

#### Scenario: Member token cannot send channel error row
- **WHEN** a caller with `member` token invokes the error-send API
- **THEN** the request is rejected with a permission error
- **THEN** no new message row is appended

#### Scenario: Admin token can send channel error row
- **WHEN** a caller with `admin` token invokes the error-send API
- **THEN** the channel appends an `error` message row
- **THEN** authorized readers receive that row through transport updates
