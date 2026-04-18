## 1. Persistence Control Planes

- [x] 1.1 Add the auth-scoped draft resource store and typed server contract for create/get/list/save/delete
- [x] 1.2 Expose shared client-sdk methods for auth KV and draft resources without leaking raw transport glue into feature code

## 2. WebUI State Ownership Migrations

- [x] 2.1 Migrate running-avatar pins from browser-local storage to the auth-scoped server KV plane
- [x] 2.2 Keep workbench tabs on client-local persistence and make their device-local projection law explicit in code comments/tests
- [x] 2.3 Migrate avatar create flow so the route truth comes from draft resources while avatar create tabs remain device-local presence

## 3. Verification

- [x] 3.1 Add targeted tests for the auth-scoped draft store and TRPC draft contract
- [x] 3.2 Add targeted tests for running-avatar pin sync and avatar draft resume behavior
