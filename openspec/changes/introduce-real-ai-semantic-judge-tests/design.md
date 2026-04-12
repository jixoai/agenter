## Context

The repository already has two strong primitives:

- `@agenter/settings/loadSettings(...)` resolves project, user, and local settings through one inherited cascade.
- `ModelClient` provides canonical provider routing and message-based model calls for multiple standards.

What is still missing is a clean semantic assertion layer for tests. Real-AI acceptance tests currently use exact string markers for many checks that are actually semantic questions. That creates false negatives, encourages prompt pinning, and leaves no clean place to reuse low-cost models for verification.

The user requirement is explicit:

- reuse inherited settings loading
- fix the test provider id to `jixoai/agenter/test`
- warn instead of silently falling back when the provider is absent
- provide two layers: generic judges and targeted helpers with cheap fast-path checks

## Goals / Non-Goals

**Goals:**

- Reuse the existing settings cascade to resolve a dedicated semantic-judge provider from project or home settings.
- Add a generic, type-safe semantic judge API that supports boolean, span, completion-style, and structured schema outputs.
- Keep the semantic judge reusable without coupling it to any specific scenario or prompt.
- Add targeted helpers such as URL detection that short-circuit obvious negatives before calling the model.
- Convert selected real-AI validations to the new helper layer so the architecture is exercised by real tests.

**Non-Goals:**

- Replacing every existing real-AI assertion in one pass.
- Introducing a second provider-loading stack or separate semantic-test config file format.
- Making semantic judge calls part of production runtime behavior.
- Reworking the existing real loopbus provider cache strategy in this change.

## Decisions

### 1. Keep semantic judge as a reusable platform primitive, keep fixed-provider resolution in test-support

The generic judge engine belongs in `packages/app-server/src` because it is a stable abstraction over model-backed semantic decisions. The fixed provider id `jixoai/agenter/test` and warning/skip semantics are test policy, so they belong in `packages/app-server/test-support`.

Why:

- This preserves orthogonality: model-backed semantic judging is generic, but "which provider id should tests use" is test-only policy.
- Future runtime or tooling features can reuse the judge primitive without inheriting test gating behavior.

Alternative considered:

- Put everything in `test-support`. Rejected because it would bury a generic cross-scenario primitive in a test-only directory and encourage duplicate implementations later.

### 2. Extend `ModelClient.respondWithMeta(...)` with per-call generation overrides

The judge layer needs tiny token budgets and deterministic temperature without mutating the provider's default runtime config. The cleanest solution is to let a call override `temperature` and `maxTokens`.

Why:

- This avoids building a second raw HTTP path just for tests.
- The same model routing, retry, and credential behavior stay centralized in `ModelClient`.

Alternative considered:

- Instantiate a new `ModelClient` for every judge mode with rewritten provider config. Rejected because it duplicates transport setup and hides per-call intent.

### 3. Implement structured judging as prompt + parse + zod validation

The judge layer will request strict JSON text and then validate it with the supplied schema. This keeps the implementation standard-first and transport-agnostic instead of depending on provider-specific structured-output features.

Why:

- Works across the current provider standards already supported by `ModelClient`.
- Keeps type safety explicit in repo-owned code.

Alternative considered:

- Rely on adapter-specific `structuredOutput(...)` APIs. Rejected for now because it creates tighter coupling to third-party adapter internals and uneven provider support.

### 4. Targeted helpers must be able to avoid needless model calls

Targeted helpers such as `judgeContainsUrl(content)` shall apply cheap lexical pre-checks first. For URLs, an obvious negative path is "no `http://`, `https://`, or `www.` signal at all", which can return false immediately. Positive candidates can then delegate to the generic judge to confirm and optionally return the span.

Why:

- Preserves the "architecture does less, algorithms do more" rule.
- Keeps cost and latency bounded for common simple cases.

Alternative considered:

- Always call AI for every semantic assertion. Rejected because it wastes tokens and weakens determinism where a zero-cost filter already suffices.

### 5. Missing judge provider is a warning + skip precondition, not an implicit fallback

The semantic-judge provider id is fixed to `jixoai/agenter/test`. If the inherited settings cascade does not resolve that provider with usable credentials, real semantic tests remain opt-in and skip with an explicit warning describing where the provider can be configured.

Why:

- Makes test intent explicit and debuggable.
- Avoids accidentally burning the default interactive runtime provider on test traffic.

Alternative considered:

- Fall back to the active provider or first configured provider. Rejected because it makes tests nondeterministic and violates the fixed-provider contract.

## Risks / Trade-offs

- [Model answers can still be unstable] -> Keep boolean/span prompts tiny, default judge temperature to `0`, and validate outputs strictly.
- [Developers may forget to configure the fixed provider] -> Emit an explicit warning naming `jixoai/agenter/test` and the supported settings locations.
- [Targeted helper surface could sprawl into scenario-specific hacks] -> Keep helper APIs domain-generic; scenario-specific assertions must remain in tests.
- [Per-call overrides change shared model-client behavior] -> Limit overrides to optional fields and preserve default config when not supplied.

## Migration Plan

1. Add the new OpenSpec artifacts and implement the generic judge primitive.
2. Add fixed-provider resolution in test-support using `loadSettings(...)`.
3. Add targeted URL helper and availability/warning gating.
4. Migrate selected real-AI tests to the helper layer.
5. Run focused unit tests plus gated real-AI tests where provider config is available.
6. Sync durable specs and archive the change once implementation and verification pass.

## Open Questions

- Should a later change unify `resolveRealModelConfig(...)` with the fixed test-provider resolver, or keep "interactive real runtime provider" and "semantic judge provider" separate long term.
- Which additional targeted helpers deserve first-class support after URL detection: semantic yes/no classification, phrase leakage checks, or structured extraction helpers.
