## MODIFIED Requirements

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

### Requirement: Real semantic validations SHALL stay opt-in and explicit

Real semantic validations SHALL remain opt-in test flows that skip cleanly when the fixed judge provider is unavailable, and those validations SHALL prefer semantic-judge-backed behavioral assertions over brute-force literal string enumeration.

#### Scenario: Opt-in semantic test suite skips without hidden fallback

- **WHEN** the real semantic test flag is disabled or the fixed judge provider is unavailable
- **THEN** semantic real-AI tests are skipped instead of failing deep inside model transport
- **THEN** the skip reason identifies the fixed provider precondition

#### Scenario: Real integration tests validate semantic behavior without brittle allowlists

- **WHEN** a real-AI integration test needs to verify acknowledgement, relay intent, fetched-answer semantics, or other meaning-level behavior
- **THEN** it uses semantic-judge-backed assertions or structured behavioral extraction
- **THEN** it does not rely on brute-force string-enumeration allowlists except for deliberate exact-protocol literals
