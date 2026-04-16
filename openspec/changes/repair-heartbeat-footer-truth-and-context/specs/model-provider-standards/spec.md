## ADDED Requirements

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
