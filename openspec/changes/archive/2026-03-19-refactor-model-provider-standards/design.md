## Context

The repository already exposes multiple provider labels in settings, but `ModelClient` still branches on `kind` and mixes together three distinct concerns: protocol format, vendor compatibility quirks, and optional vendor-only enhancements. This has already produced DeepSeek-specific paths and makes future support for Kimi, GLM, Doubao, or other compatible vendors fragile.

A second constraint is that the current `@tanstack/ai-openai` text adapter internally uses OpenAI Responses semantics even though our product still needs to reason about `openai-chat`, `openai-completion`, and `openai-responses` as separate compatibility declarations. The product therefore needs its own standard layer instead of leaking SDK naming into user-facing configuration.

## Goals / Non-Goals

**Goals:**
- Introduce a canonical provider model centered on `apiStandard` with separate vendor/profile metadata.
- Normalize legacy `kind` settings into the canonical model at load time.
- Make adapter selection standard-driven and capability-driven.
- Preserve the existing AgenterAI/LoopBus integration seam by keeping `ModelClient` as the runtime entry point.
- Expose richer model metadata to runtime inspection and WebUI debug surfaces.

**Non-Goals:**
- Fully implement every vendor-private extension such as Kimi file upload or GLM MCP in this change.
- Redesign LoopBus, session persistence, or prompt composition beyond the provider metadata they consume.
- Preserve backwards compatibility for internal TypeScript types; canonical runtime types may change as part of this refactor.

## Decisions

### 1. Canonical provider config is `apiStandard` + `vendor`
The canonical resolved provider shape will replace `kind` with:
- `apiStandard`: `gemini | anthropic | openai-chat | openai-completion | openai-responses`
- `vendor`: vendor identity such as `deepseek`, `openai`, `anthropic`, `google`, `kimi`, `glm`, `doubao`, `ollama`
- optional `profile`, `extensions`, and `headers`

This keeps protocol truth separate from vendor truth. The alternative was extending `kind` with more values, but that would continue to conflate standard and vendor and would not model vendors supporting multiple standards.

### 2. Legacy settings are normalized once, not carried through runtime
`@agenter/settings` will accept legacy `kind` inputs for now, but the loader will normalize them into the canonical provider shape before anything in `@agenter/app-server` consumes them. This keeps the compatibility layer shallow and avoids repeated `kind` branches across runtime code.

### 3. Adapter routing is standard-first
`ModelClient` will resolve an adapter through a registry keyed by `apiStandard`, then apply vendor profile adjustments. The initial standards are:
- `gemini`
- `anthropic`
- `openai-chat`
- `openai-completion`
- `openai-responses`

OpenAI-compatible chat/completions and Anthropic-compatible services are modeled as vendor/profile combinations on top of these standards.

### 4. Capability resolution is explicit
A `ModelCapabilities` object will be computed from standard defaults and vendor/profile overrides. This prevents implicit behavior such as “DeepSeek summarize is null” from being hidden in adapter branches.

Initial capabilities include:
- `streaming`
- `tools`
- `imageInput`
- `nativeCompact`
- `summarizeFallback`
- `fileUpload`
- `mcpCatalog`

### 5. Vendor-specific enhancements use extension hooks
A small extension interface will be introduced so future vendor optimizations can patch requests or add auxiliary abilities without contaminating the protocol adapters. The alternative was subclassing each adapter ad hoc per vendor, but that would scale poorly once multiple vendors share the same standard.

### 6. Debug metadata follows the canonical model
Runtime draft resolution, model debug payloads, and model-call metadata will expose `apiStandard`, `vendor`, `profile`, `baseUrl`, and capabilities. This keeps Devtools aligned with the actual routing logic and removes the current DeepSeek-first illusion.

## Risks / Trade-offs

- [Risk] OpenAI naming conflicts with TanStack adapter naming → Mitigation: keep product-level `apiStandard` names explicit and map them to underlying adapter factories internally.
- [Risk] Legacy config compatibility may mask invalid assumptions → Mitigation: normalize centrally, add tests for every legacy mapping, and remove runtime reliance on `kind`.
- [Risk] `openai-completion` has fewer capabilities than chat/responses → Mitigation: capability resolution must explicitly disable unsupported features and compact paths.
- [Risk] UI/tests may drift after payload changes → Mitigation: update client-sdk/webui contracts in the same change and add BDD tests for debug payload shape.

## Migration Plan

1. Add canonical provider types and normalization in `@agenter/settings`.
2. Update `resolveSessionConfig` and downstream runtime payloads to expose the canonical provider shape.
3. Refactor `ModelClient` into standard-driven routing and vendor capability resolution.
4. Remove top-level DeepSeek-first branching and keep only vendor profile overrides.
5. Update client/debug surfaces and tests.
6. Keep legacy `kind` parsing only at settings input boundaries.
