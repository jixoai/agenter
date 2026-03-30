## REMOVED Requirements

### Requirement: Email ownership SHALL bootstrap through OTP verification and WebAuthn
**Reason**: `AuthSystem` 不再把 email OTP + WebAuthn 作为默认登录入口。
**Migration**: 默认认证流程改为私钥签名 challenge 并换取短期 JWT；email / WebAuthn 仅可作为后续备选能力，而不是主链路。

## MODIFIED Requirements

### Requirement: Wallet ownership SHALL authenticate through signed challenges
Auth service SHALL authenticate a durable auth identity by issuing a nonce challenge for a configured address or public key and exchanging a verified signature for a short-lived JWT carrying auth claims.

#### Scenario: Root auth identity exchanges a signed challenge for JWT
- **WHEN** an operator requests an auth challenge for the configured root address and returns a valid signature
- **THEN** the auth service verifies the signature against the challenge and canonical auth identity
- **THEN** the service issues a short-lived JWT containing the auth id and control-plane claims

#### Scenario: Invalid signature is rejected
- **WHEN** a caller submits a signature that does not verify for the challenge payload and declared auth id
- **THEN** the auth service rejects the authentication attempt
- **THEN** no JWT or auth claims are issued

### Requirement: Authenticated profiles SHALL link additional identifiers through proof-bearing flows
The auth service SHALL allow an authenticated auth identity to attach non-primary reference identifiers and metadata through authenticated mutations without changing the canonical auth id, and those references SHALL NOT become alternate durable login identities unless a future spec explicitly upgrades them.

#### Scenario: Auth identity attaches an email reference
- **WHEN** an authenticated auth identity adds an email or similar reference identifier for presentation or lookup
- **THEN** the identifier is stored as metadata or a reference attachment for that same auth identity
- **THEN** later default auth still resolves through the canonical auth id instead of that reference

#### Scenario: Reference identifier cannot take over another auth identity
- **WHEN** a caller attempts to attach or rewrite a reference identifier in a way that would impersonate a different canonical auth identity
- **THEN** the service rejects the mutation
- **THEN** the original auth binding remains unchanged
