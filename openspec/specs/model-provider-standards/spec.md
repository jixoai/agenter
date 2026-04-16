## Purpose

Define the canonical AI provider contract used by settings loading, runtime adapter routing, and operator inspection.

## Requirements

### Requirement: Canonical provider settings SHALL be standard-first
The system SHALL resolve AI provider configuration into a canonical structure that separates API standard from vendor identity. The canonical provider structure MUST include `apiStandard` and `model`, MAY include `vendor`, and MUST be the only provider shape used by runtime routing after settings are loaded.

#### Scenario: Loading canonical provider settings
- **WHEN** settings define a provider using the canonical structure
- **THEN** the loaded settings preserve `apiStandard`, `vendor`, and `model` without converting them back into legacy `kind` values

#### Scenario: Normalizing legacy provider settings
- **WHEN** settings define a provider using a legacy `kind`
- **THEN** the loader normalizes that provider into the canonical standard-first structure before returning loaded settings

### Requirement: Provider routing SHALL select adapters by API standard
The runtime SHALL choose its model transport according to the provider `apiStandard` and SHALL treat vendor-specific behavior as profile or extension logic layered on top of the standard transport.

#### Scenario: Routing an OpenAI-compatible vendor
- **WHEN** a provider declares `apiStandard` as `openai-chat` or `openai-responses`
- **THEN** the runtime selects the corresponding OpenAI-family adapter regardless of the vendor name

#### Scenario: Routing an Anthropic-compatible vendor
- **WHEN** a provider declares `apiStandard` as `anthropic`
- **THEN** the runtime selects the Anthropic-family adapter regardless of the vendor name

### Requirement: Provider capabilities SHALL be explicit
The runtime SHALL compute model capabilities from the declared API standard plus vendor/profile overrides, and downstream systems MUST consume those computed capabilities instead of inferring behavior from provider names.

#### Scenario: Unsupported standard features are disabled explicitly
- **WHEN** a provider uses a standard that does not support a feature such as tools or compact fallback
- **THEN** the resolved provider capabilities mark that feature as unsupported

#### Scenario: Vendor profile overrides capabilities
- **WHEN** a vendor profile changes the default capability set for a standard
- **THEN** the resolved provider capabilities reflect the vendor-specific override

### Requirement: Runtime inspection SHALL expose canonical provider metadata
The runtime SHALL expose canonical provider metadata and capabilities in draft resolution, model debug views, and model-call records so that operator tooling can inspect the actual transport contract in use.

#### Scenario: Inspecting draft provider metadata
- **WHEN** a draft session is resolved for a workspace
- **THEN** the returned provider metadata includes `apiStandard`, `vendor`, `model`, and `baseUrl` when available

#### Scenario: Inspecting model debug metadata
- **WHEN** the model debug endpoint is queried
- **THEN** the response includes canonical provider metadata and computed capabilities for the active provider

### Requirement: Canonical provider metadata SHALL support context-window and tiered pricing inspection

The canonical provider settings contract SHALL support optional operator-inspection metadata for context window size and tiered price estimation. When present, this metadata SHALL remain part of the canonical provider shape rather than being modeled as per-call runtime knobs.

#### Scenario: Provider settings declare max-context and pricing bands
- **WHEN** settings define canonical provider metadata for max context and pricing
- **THEN** the loaded provider preserves optional `maxContextTokens`
- **AND** it preserves optional pricing metadata including currency plus tiered uncached-input, cached-input, and output rates

#### Scenario: Missing pricing metadata remains valid provider configuration
- **WHEN** a provider omits context-window or pricing metadata
- **THEN** the provider still resolves as a valid canonical provider
- **AND** downstream inspection surfaces treat those metadata fields as unavailable instead of fabricating defaults

### Requirement: Operator cost inspection SHALL remain explicitly estimated

Operator-facing surfaces that consume provider pricing metadata SHALL treat it as an estimate source rather than as exact billing truth.

#### Scenario: Cached-hit detail is unavailable
- **WHEN** a model-call usage record includes prompt and completion tokens but does not expose cached-hit token detail
- **THEN** operator inspection computes cost, if at all, from the available usage and provider pricing metadata as an estimate
- **AND** the surface does not present that number as exact provider billing
