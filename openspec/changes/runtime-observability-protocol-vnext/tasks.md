## 1. Runtime publication contract

- [x] 1.1 Rename runtime tRPC procedures and realtime event names from `loopbus*` to scheduler/observability-first names across `app-server` and first-party consumers.
- [x] 1.2 Remove the orphan `modelDebug` runtime endpoint and any first-party client helpers that exist only for that endpoint.
- [x] 1.3 Keep canonical transport inspection intact through model-call and API-call publication after the rename.

## 2. Client runtime store and WebUI migration

- [x] 2.1 Rename client-runtime-store state slices, cursors, access maps, and load-more methods away from `loopbus*` naming.
- [x] 2.2 Rename shared long-history paging resource ids from `loopbus-trace` to an observability-first resource id and update WebUI selectors/loaders.
- [x] 2.3 Update route consumers, fixtures, and stories so scheduler/observability data is consumed directly without legacy protocol translation.

## 3. Verification and residual cleanup

- [x] 3.1 Add or update targeted tests in `app-server`, `client-sdk`, and `webui` covering renamed runtime publication and store hydration.
- [x] 3.2 Run `openspec validate`, targeted package tests, and WebUI build to prove the breaking protocol migration is coherent.
- [x] 3.3 Audit residual `loopbus*` protocol strings and document deferred inner-engine/storage renames that stay outside this change.
