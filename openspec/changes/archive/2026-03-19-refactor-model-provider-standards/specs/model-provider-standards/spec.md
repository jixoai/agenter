## ADDED Requirements

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
