## Why

The runtime has already moved from legacy attention egress wording toward explicit `dispatch / receipt / delivery projection` and explicit message mutations, but several durable specs and comments still describe the old law. Terminal admin candidates also appear to have two persistence surfaces, which risks future code treating metadata as a competing truth source.

## What Changes

- **BREAKING** Remove remaining durable `egress` wording from current runtime and attention law; external visible effects must be represented by explicit system mutations or delivery dispatch/receipt facts.
- Clarify that `AttentionSystem` is a `Context + Items` information carrier: `Context` is the current cognitive snapshot and commits/items are objective or subjective inputs that influence that snapshot.
- Clarify that `session-system` is an AI-call historian: it records objective AI-call-adjacent facts for reconstruction and inspection, not source-system business truth.
- **BREAKING** Make terminal admin candidates canonical only in the `terminal_admin_candidate` table; terminal metadata must not duplicate `adminGroupCandidateIds`.
- Add BDD coverage so future refactors cannot reintroduce old egress docs or terminal admin candidate duplicate truth.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `attention-runtime-kernel`: Clarify the current attention law and remove user-visible output/egress adapter assumptions that conflict with explicit system mutations.
- `attention-cycle-frame`: Replace linked egress refs with current model-call, hook, dispatch, and receipt inspection facts.
- `loopbus-attention-output-pipeline`: Mark the old egress-adapter output pipeline as superseded by neutral ingress adapters plus explicit delivery receipts and message mutations.
- `attention-bootstrap-protocol`: Remove prompt-side routing descriptor assumptions from attention item serialization.
- `attention-native-context-graph`: Replace provenance/egress separation language with provenance/body plus explicit system mutation language.
- `attention-source-plugins`: Replace draft egress intent language with typed presentation/provenance/semantic fields and explicit mutation guidance.
- `attention-egress-routing`: Keep the behavior but rename the current law around explicit system mutations rather than hidden routing fields.
- `loopbus-plugin-pipeline`: Replace ingress/egress plugin vocabulary with source ingress, lifecycle hooks, delivery observation, and explicit mutation extension points.
- `attention-trace-publication`: Replace trace lookup through egress refs with delivery and explicit mutation refs.
- `attention-trace-spans`: Replace egress dispatch span vocabulary with delivery and explicit mutation spans.
- `runtime-json-tool-descriptor-surface`: Replace message-tool help wording that still names room egress schema.
- `session-runtime-attention-message`: Replace tool-egress wording with tool-side-effect wording.
- `session-ai-call-ledger`: Clarify historian semantics around `ai_call`, message parts, dispatches, and receipts.
- `terminal-collaboration-access-control`: Require terminal admin candidates to use the canonical table rather than a metadata mirror.

## Impact

- `SPEC.md`
- `packages/app-server/SPEC.md`
- `openspec/specs/attention-runtime-kernel/spec.md`
- `openspec/specs/attention-cycle-frame/spec.md`
- `openspec/specs/loopbus-attention-output-pipeline/spec.md`
- `openspec/specs/session-ai-call-ledger/spec.md`
- `openspec/specs/terminal-collaboration-access-control/spec.md`
- `packages/attention-system/src/*`
- `packages/session-system/src/*`
- `packages/terminal-system/src/*`
- Targeted BDD tests for attention law drift, session historian comments, and terminal admin truth.
