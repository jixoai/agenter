## ADDED Requirements

### Requirement: Email ownership SHALL bootstrap through OTP verification and WebAuthn
The profile service SHALL support email-based identity bootstrap by issuing a short-lived one-time code, verifying that code, and then requiring WebAuthn registration or authentication before minting a durable auth token for the profile.

#### Scenario: Email registration completes through OTP and passkey
- **WHEN** a caller requests an email challenge, verifies the printed OTP code, and completes WebAuthn registration
- **THEN** the service creates or resolves the canonical profile for that email identifier
- **AND** the service issues an auth token scoped to that profile

#### Scenario: Email OTP alone does not become durable profile auth
- **WHEN** a caller verifies an email OTP but does not complete the required WebAuthn step
- **THEN** the service only issues a short-lived registration ticket
- **AND** it does not mint a durable profile auth token yet

### Requirement: Wallet ownership SHALL authenticate through signed challenges
The profile service SHALL support wallet-based authentication by issuing a challenge payload for a supported wallet family and verifying a cryptographic signature over that challenge before resolving or creating the bound profile.

#### Scenario: EVM wallet signs a challenge
- **WHEN** a caller requests an EVM wallet challenge and submits a valid signature for the declared address
- **THEN** the service verifies the signature against the challenge payload and address
- **AND** the service resolves or creates the canonical profile bound to that wallet identifier

#### Scenario: Invalid wallet proof is rejected
- **WHEN** a caller submits a signature that does not verify for the challenge and wallet address
- **THEN** the service rejects the authentication attempt
- **AND** no profile auth token is issued

### Requirement: Authenticated profiles SHALL link additional identifiers through proof-bearing flows
The profile service SHALL allow an already authenticated profile to link additional email or wallet identifiers only after the caller presents a fresh proof for that new identifier. Linking SHALL preserve uniqueness so one durable identifier cannot be attached to multiple profiles.

#### Scenario: Authenticated profile links a second identifier
- **WHEN** an authenticated profile owner completes a valid proof flow for an unbound email or wallet identifier
- **THEN** the service binds that identifier to the existing profile
- **AND** later reads through the new identifier resolve the same profile

#### Scenario: Bound identifier cannot be stolen by another profile
- **WHEN** a caller attempts to link an identifier that is already bound to another profile
- **THEN** the service rejects the link request
- **AND** the original binding remains unchanged
