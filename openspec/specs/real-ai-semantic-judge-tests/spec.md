## Purpose

Define the real-AI semantic judge testing contract used by backend validation suites.

## Requirements

### Requirement: Real-AI semantic judge tests SHALL resolve a fixed provider from inherited settings

Real-AI semantic test utilities SHALL resolve provider id `jixoai/agenter/test` from the existing inherited settings cascade, so project-local and user-home `.agenter/settings.json` can both supply the same provider contract.

#### Scenario: Project or home settings provide the fixed semantic judge provider

- **WHEN** the semantic test utilities load settings for a project root
- **THEN** they resolve provider id `jixoai/agenter/test` from the inherited settings cascade instead of using a separate semantic-test config format
- **THEN** the resolved provider preserves the canonical provider metadata needed by `ModelClient`

#### Scenario: Missing fixed provider exposes the exact configuration precondition

- **WHEN** the inherited settings cascade does not contain usable provider id `jixoai/agenter/test`
- **THEN** semantic test availability resolves to "not configured"
- **THEN** the warning states that the provider must be configured in `jixoai/agenter/.agenter/settings.json` or `~/.agenter/settings.json`
- **THEN** the utility does not silently fall back to the active runtime provider

### Requirement: Semantic judge core SHALL provide generic model-backed decision modes

The semantic judge core SHALL provide generic boolean, span, completion-style, and structured JSON decision APIs on top of the canonical model client, and those APIs SHALL support redundant multi-attempt execution for real-AI validation flows.

#### Scenario: Boolean judge constrains output to binary truth

- **WHEN** a caller requests a boolean semantic decision
- **THEN** the judge uses a low-token deterministic model call
- **THEN** it accepts only the configured binary answer shape and returns a boolean result

#### Scenario: Span judge returns a normalized range contract

- **WHEN** a caller requests a semantic span decision
- **THEN** the judge returns a normalized `[start,end]` range
- **THEN** absence is represented as `[0,0]`

#### Scenario: Structured judge validates schema-shaped output

- **WHEN** a caller requests a structured semantic decision with a zod schema
- **THEN** the judge requests strict JSON output
- **THEN** it validates the parsed payload against the supplied schema before returning the result

#### Scenario: Completion-style judge constrains the returned suffix

- **WHEN** a caller supplies a prefix for completion-style judging
- **THEN** the judge treats the model output as a suffix continuation of that prefix
- **THEN** the combined output is parsed by the caller-selected contract

#### Scenario: Redundant judge attempts converge on quorum

- **WHEN** a caller enables redundant semantic judging with `2~3` parallel attempts
- **THEN** the judge parses each attempt independently
- **THEN** it returns the majority or quorum result when enough valid attempts agree
- **THEN** a single empty or malformed attempt does not fail the overall decision if quorum is still satisfied

#### Scenario: Redundant judge failure exposes attempt diagnostics

- **WHEN** redundant semantic judging cannot reach quorum because outputs are invalid or disagree
- **THEN** the semantic judge raises a diagnostic-rich error
- **THEN** the error includes enough attempt evidence to debug the provider behavior

### Requirement: Targeted semantic helpers SHALL fast-path obvious negatives before paying for AI

Targeted semantic helpers SHALL apply cheap deterministic pre-checks before delegating to the generic semantic judge, and ambiguous cases SHALL use the configured redundant generic decision mode instead of a single fragile model response.

#### Scenario: URL helper short-circuits obvious non-URL content

- **WHEN** `judgeContainsUrl(content)` receives content with no URL-like lexical signal
- **THEN** it returns `false` without issuing a model call

#### Scenario: URL helper confirms candidate content through the generic judge layer

- **WHEN** `judgeContainsUrl(content)` receives content with URL-like lexical signal
- **THEN** it delegates to the generic judge layer to confirm presence semantics
- **THEN** callers can also request the URL span through the same helper family

#### Scenario: Targeted helpers preserve cheap pre-checks under redundant judging

- **WHEN** a targeted helper can reject or accept a case through deterministic local evidence
- **THEN** it does not pay for redundant AI calls
- **THEN** only the ambiguous remainder is delegated to the redundant generic judge

### Requirement: Enabled real semantic validations SHALL hard-fail on missing provider setup

Real semantic validations MAY still be gated behind an explicit real-test switch, but once that suite is enabled, provider id `jixoai/agenter/test` becomes a mandatory CI precondition. Missing provider setup SHALL fail immediately instead of warning-and-skipping.

#### Scenario: Enabled semantic suite fails before execution when provider is absent

- **WHEN** the real semantic test flag is enabled but the fixed judge provider is unavailable
- **THEN** the suite fails immediately with the fixed-provider configuration error
- **THEN** it does not downgrade the run to a warning or skip

#### Scenario: Real integration tests validate semantic behavior without brittle allowlists

- **WHEN** a real-AI integration test needs to verify acknowledgement, relay intent, fetched-answer semantics, or other meaning-level behavior
- **THEN** it uses semantic-judge-backed assertions or structured behavioral extraction
- **THEN** it does not rely on brute-force string-enumeration allowlists except for deliberate exact-protocol literals
