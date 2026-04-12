## Why

The current runtime law for prompt assembly has already shifted in code, but the durable OpenSpec truth is behind reality. In particular, `attention-runtime-kernel` still says provider-owned system guides belong in `systemPrompt`, while the current backend direction is the opposite:

- `app-server` is only prompt-side deep-coupled to `attention-system`
- `messageSystem` / `terminalSystem` / `taskSystem` / `workspaceSystem` help must no longer pollute global `systemPrompt`
- dynamic system help must instead be mounted through `attention-system + LoopBus plugin runtime`
- the model request must now start from a two-stage attention protocol: bootstrap `context`, then delta `items`

If this drift stays undocumented, future work can easily regress by reintroducing provider-owned prompt glue or by flattening attention bootstrap back into ad hoc prompt text. The missing OpenSpec work is therefore not “prompt copywriting”; it is the platform-law correction that defines where dynamic system guidance belongs and how bootstrap facts are serialized.

## What Changes

- Correct the runtime prompt law so `systemPrompt` stays global, stable, and provider-agnostic.
- Add an explicit attention-bootstrap capability that defines the `context` + `items` two-stage protocol.
- Record that dynamic system descriptions and long guides are resolved through `AttentionContextGuideProvider` rather than provider-owned prompt sections.
- Record that cycle persistence keeps `attentionContextIds` and `attentionCommitRefs` so bootstrap/delta provenance survives inspection and replay.
- Capture the remaining hardening work: shared bootstrap formatter, compact/replay audit, and any remaining guide-provider migration.

## Capabilities

### New Capabilities

- `attention-bootstrap-protocol`: defines the prompt-side bootstrap document, active-system descriptions, grouped attention-context guides, delta attention items, and cycle persistence refs.

### Modified Capabilities

- `attention-runtime-kernel`: remove provider-owned system-guide injection from `systemPrompt` and move dynamic system help into attention bootstrap.

## Impact

- Affected systems: `packages/app-server`, `packages/attention-system`, LoopBus plugin runtime integrations, prompt assembly tests, and cycle persistence inspection.
- Affected APIs: `AttentionContextGuideProvider` and runtime attention input collection become the only supported extension path for dynamic system guidance.
- Affected operations: inactive systems stop contributing prompt help; active systems contribute one-line descriptions plus grouped long guides through bootstrap context instead of system prompt glue.
