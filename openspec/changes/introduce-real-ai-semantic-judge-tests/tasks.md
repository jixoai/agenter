## 1. Platform primitives

- [x] 1.1 Extend `ModelClient.respondWithMeta(...)` so callers can override `temperature` and `maxTokens` per request.
- [x] 1.2 Add a reusable semantic judge core with boolean, span, completion-style, and structured JSON APIs.
- [x] 1.3 Add targeted helper APIs with cheap pre-checks, starting with URL detection and URL span extraction.

## 2. Test provider resolution

- [x] 2.1 Add test-support utilities that resolve fixed provider `jixoai/agenter/test` through inherited settings loading.
- [x] 2.2 Add warning-first availability checks so missing provider config skips opt-in real semantic tests without hidden fallback.

## 3. Verification

- [x] 3.1 Add unit tests for fixed-provider resolution, missing-provider warnings, and semantic judge parsing contracts.
- [x] 3.2 Migrate selected real-AI validations to the semantic judge helper layer and verify the real test gate still works.
- [x] 3.3 Sync durable specs, run focused test suites, and archive the change after verification passes.
