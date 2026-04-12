## Why

The runtime recently simplified attention items, which made the model-facing payload cleaner but also exposed a new asymmetry: systems were still depending on open `meta` fields to carry context that the AI actually needs, while the provider prompt only consumes the text body. At the same time, LoopBus and source adapters still carry legacy “generic message bus” contracts that tempt systems to smuggle business data through transport metadata instead of through durable facts or typed tools.

## What Changes

- Enrich attention bootstrap and delta payloads so AI-visible context is carried in the attention body itself, derived from each system's authoritative truth, rather than hidden in open metadata. **BREAKING**
- Restrict attention commit metadata to durable provenance fields only, and move routing intent out of `meta` into typed attention egress descriptors. **BREAKING**
- Replace open source-draft metadata in the runtime ingestion path with typed draft fields for presentation, provenance, semantic identity, and egress intent. **BREAKING**
- Clarify that LoopBus transport metadata is scheduler/protocol-only; system-private state and AI-relevant content MUST NOT flow through LoopBus `meta`. **BREAKING**
- Add backend regression tests plus frontend integration notes describing the new attention payload contract and reactive consumption expectations.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `attention-bootstrap-protocol`: bootstrap `context` and delta `items` now carry AI-ready body content without depending on hidden metadata side channels.
- `attention-runtime-kernel`: runtime attention ingestion and model-round assembly now treat body content as the AI truth and keep LoopBus metadata scheduler-only.
- `attention-source-plugins`: source adapters now produce typed attention draft fields instead of open metadata bags for model-facing information.
- `attention-egress-routing`: attention routing intent moves from commit metadata into typed egress descriptors.
- `attention-native-context-graph`: attention commits now separate provenance metadata from typed egress intent instead of using extensible metadata as a mixed-purpose container.
- `loopbus-plugin-pipeline`: plugin/runtime contracts now distinguish source lookup hints from attention payload facts and forbid AI-facing payloads from leaking through generic LoopBus metadata.

## Impact

- Affected code: `packages/app-server`, `packages/attention-system`, related app-server integration/unit tests, and backend verification scripts.
- Affected APIs: runtime attention inspection, provider request assembly, attention query/tool contracts, and egress hook payloads.
- Affected docs: durable OpenSpec attention/LoopBus specs plus `.chat` frontend integration notes for later UI work.
