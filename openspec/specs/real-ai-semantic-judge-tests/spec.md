## Purpose

Define the real-AI semantic judge testing contract used by backend validation suites.

## Requirements

### Requirement: Real-AI semantic judge tests SHALL resolve a fixed provider from inherited settings

Real-AI semantic test utilities SHALL resolve provider id `jixoai/agenter/test` from the existing inherited settings cascade, so project-local and user-home `.agenter/settings.json` can both supply the same provider contract.

#### Scenario: Project or home settings provide the fixed semantic judge provider

- **WHEN** the semantic test utilities load settings for a project root
- **THEN** they resolve provider id `jixoai/agenter/test` from the inherited settings cascade instead of using a separate semantic-test config format
- **THEN** the resolved provider preserves the canonical provider metadata needed by `ModelClient`

#### Scenario: Missing fixed provider emits a warning precondition

- **WHEN** the inherited settings cascade does not contain usable provider id `jixoai/agenter/test`
- **THEN** semantic test availability resolves to "not configured"
- **THEN** the warning states that the provider must be configured in `jixoai/agenter/.agenter/settings.json` or `~/.agenter/settings.json`
- **THEN** the utility does not silently fall back to the active runtime provider

### Requirement: Semantic judge core SHALL provide generic model-backed decision modes

The semantic judge core SHALL provide generic boolean, span, completion-style, and structured JSON decision APIs on top of the canonical model client.

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

### Requirement: Targeted semantic helpers SHALL fast-path obvious negatives before paying for AI

Targeted semantic helpers SHALL apply cheap deterministic pre-checks before delegating to the generic semantic judge.

#### Scenario: URL helper short-circuits obvious non-URL content

- **WHEN** `judgeContainsUrl(content)` receives content with no URL-like lexical signal
- **THEN** it returns `false` without issuing a model call

#### Scenario: URL helper confirms candidate content through the generic judge layer

- **WHEN** `judgeContainsUrl(content)` receives content with URL-like lexical signal
- **THEN** it delegates to the generic judge layer to confirm presence semantics
- **THEN** callers can also request the URL span through the same helper family

### Requirement: Real semantic validations SHALL stay opt-in and explicit

Real semantic validations SHALL remain opt-in test flows that skip cleanly when the fixed judge provider is unavailable.

#### Scenario: Opt-in semantic test suite skips without hidden fallback

- **WHEN** the real semantic test flag is disabled or the fixed judge provider is unavailable
- **THEN** semantic real-AI tests are skipped instead of failing deep inside model transport
- **THEN** the skip reason identifies the fixed provider precondition
