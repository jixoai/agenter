## Context

The current semantic judge platform already separates generic judge primitives from targeted helper functions, and it already resolves a fixed real provider from inherited settings. Running the real suite against the actual global provider shows that this architecture is directionally correct, but a single deterministic low-token call is still too fragile for live semantic assertions. At the same time, several real integration tests still encode semantic intent through literals such as acknowledgement markers or reply prefixes, which turns provider phrasing variance into false regressions.

## Goals / Non-Goals

**Goals:**

- Keep semantic judging as a reusable platform primitive rather than test-local glue.
- Allow semantic decisions to fan out into `2~3` redundant model calls and converge on a stable result.
- Preserve cheap deterministic fast-path checks inside targeted helpers.
- Migrate real-AI integration assertions away from brittle literal-string semantics.
- Keep diagnostics explicit enough to debug disagreement between redundant judge attempts.

**Non-Goals:**

- Do not change runtime product behavior just to satisfy a test-only phrase.
- Do not introduce a second semantic-test provider contract outside inherited settings.
- Do not replace deliberate exact-protocol assertions where the test is validating a literal contract by design.

## Decisions

### Decision: Redundant judging belongs in the generic judge layer

The platform already has one generic layer (`judgeBoolean`, `judgeSpan`, `judgeCompletion`, `judgeStructured`) and one targeted helper layer. Redundancy must live in the generic layer so every caller can opt into the same quorum behavior without rebuilding majority-vote glue per helper or per test.

Chosen approach:

- Extend generic judge APIs with redundant-attempt options.
- Execute redundant attempts in parallel.
- Parse each attempt independently.
- Return the majority result when quorum is met.
- If no quorum is reached, surface a diagnostic-rich semantic judge error and, where appropriate, allow a more structured fallback path.

Rejected alternative:

- Implement retry/voting separately inside each targeted helper or each test.
  - This duplicates control flow and would immediately violate the platform-first design.

### Decision: Targeted helpers keep lexical fast-paths and then delegate to redundant generic judges

Targeted helpers such as URL or concept detection already provide cheap pre-checks. We keep that law unchanged: helpers short-circuit obvious negatives or positives locally, then call the generic judge with redundant quorum options for the ambiguous cases.

Chosen approach:

- Preserve deterministic pre-checks.
- Delegate only ambiguous cases to redundant generic judge calls.
- Add new targeted helpers only when they encode a reusable semantic contract, not just a single test’s wording.

Rejected alternative:

- Remove pre-checks and always pay for multiple model calls.
  - This increases cost and latency without improving obvious cases.

### Decision: Real-AI tests should assert behavior semantically, not by brittle phrasing

Real-provider phrasing drifts even when the underlying behavior is correct. Tests should therefore distinguish between:

- exact protocol literals that are intentionally required, and
- semantic behaviors such as “the assistant acknowledged work”, “the relay prompt does not leak the player move”, or “the final answer reports a fetched weather forecast”.

Chosen approach:

- Replace semantic string checks with semantic-judge-backed assertions or structured behavior extraction.
- Keep hard literals only for intentionally exact protocol contracts.
- Push repeated semantic test logic into reusable helpers or scenario primitives.

Rejected alternative:

- Keep widening literal string allowlists.
  - This turns test maintenance into endless patchwork and still misses paraphrases.

## Risks / Trade-offs

- [Risk] Redundant judging increases real-provider token usage and latency. → Mitigation: keep targeted fast-paths, use low-token outputs, and reserve higher-cost structured fallbacks for ambiguous cases only.
- [Risk] Majority vote can hide a provider’s instability if disagreement is never surfaced. → Mitigation: emit per-attempt diagnostics when quorum fails or when invalid outputs appear.
- [Risk] Overusing semantic AI assertions can make tests too permissive. → Mitigation: preserve exact assertions for explicit protocol literals and combine semantic checks with structural/tool-trace assertions.
- [Risk] Weather/interleaved scenarios may reveal real runtime issues, not only assertion brittleness. → Mitigation: inspect scenario evidence first and only broaden assertions when the actual behavior still satisfies the product contract.
