## Why

The current AI provider stack is configured as if it supports multiple vendors, but the runtime still treats provider `kind` as both vendor identity and protocol selector. That coupling makes DeepSeek-style special cases accumulate and prevents correct modeling of vendors that support multiple API standards such as OpenAI-compatible, Anthropic-compatible, and Responses-compatible transports.

This change is needed now because the product must support more model ecosystems without hard-wiring DeepSeek semantics into settings, runtime routing, and debugging surfaces.

## What Changes

- **BREAKING** Replace the internal canonical AI provider shape from `kind`-driven routing to `apiStandard` + `vendor` + optional `profile/extensions`.
- Add settings normalization so legacy `kind` values still load, but normalize immediately into the canonical provider shape.
- Refactor model adapter selection to route by API standard first, then apply vendor-specific compatibility profiles.
- Add explicit capability resolution for streaming, tools, image input, compact/summarize strategy, and vendor extensions.
- Reduce DeepSeek-specific logic into a vendor profile layer instead of a top-level provider branch.
- Update runtime/debug metadata so WebUI and logs show API standard, vendor, capabilities, and effective transport details.

## Capabilities

### New Capabilities
- `model-provider-standards`: Define standard-first provider configuration, adapter resolution, capability reporting, and vendor extension hooks.

### Modified Capabilities
- None.

## Impact

- Affected packages: `@agenter/settings`, `@agenter/app-server`, `@agenter/client-sdk`, `@agenter/webui`, and related tests.
- Public configuration/API impact: AI provider settings, session draft resolution, runtime model debug payloads, and model-call metadata.
- Runtime impact: provider selection, compact/summarize fallback behavior, and API recording/debug visibility.
