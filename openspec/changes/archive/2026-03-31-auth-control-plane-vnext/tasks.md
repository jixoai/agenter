## 1. Auth naming and identity contract

- [x] 1.1 Rewrite the new change artifacts and implementation-facing naming from `profile/principal` language to `auth` language.
- [x] 1.2 Define the durable auth identity contract and keep Avatar explicitly outside auth identity semantics.
- [x] 1.3 Document legacy `profile-*` capability ids as compatibility-only spec names.

## 2. Auth challenge and JWT lifecycle

- [x] 2.1 Add the root auth key bootstrap contract for app-server startup.
- [x] 2.2 Define challenge request, signed verification, and short-lived JWT issuance behavior.
- [x] 2.3 Define superadmin and admin claims carried through auth-issued session state.

## 3. App-server and client integration

- [x] 3.1 Define app-server child/external auth-service authority behavior.
- [x] 3.2 Define TRPC auth context and admin endpoint requirements around JWT claims.
- [x] 3.3 Define the WebUI login flow that exchanges a private key for JWT without browser-side private-key persistence.

## 4. Verification

- [x] 4.1 Add auth-service tests for challenge verification and invalid-signature rejection.
- [x] 4.2 Add app-server integration tests for root-auth bootstrap and JWT-protected admin access.
- [x] 4.3 Add WebUI or browser walkthrough coverage for login-by-private-key and JWT-backed session reuse.
