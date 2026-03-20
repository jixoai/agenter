## 1. Settings Canonicalization

- [x] 1.1 Add canonical provider types and schema support for `apiStandard`, `vendor`, `profile`, `extensions`, and `headers` in `@agenter/settings`
- [x] 1.2 Normalize legacy `kind`-based provider settings into the canonical provider shape during settings load
- [x] 1.3 Update settings tests to cover canonical providers and legacy-to-canonical mapping

## 2. Runtime Provider Resolution

- [x] 2.1 Update `resolveSessionConfig` and dependent runtime types to expose canonical provider metadata instead of `kind`
- [x] 2.2 Refactor `ModelClient` to resolve adapters by API standard and compute explicit model capabilities
- [x] 2.3 Reduce DeepSeek-specific top-level branching into vendor profile logic and keep OpenAI/Anthropic/Gemini routing standard-driven

## 3. Surfaces And Verification

- [x] 3.1 Update app-kernel, session-runtime, client-sdk, and WebUI model debug surfaces to display canonical provider metadata and capabilities
- [x] 3.2 Add BDD-style app-server and WebUI tests for provider normalization, adapter routing, capability reporting, and debug payloads
- [x] 3.3 Refresh AGENTS/SPEC/OpenSpec references as needed and run targeted typecheck/test verification for the affected packages
