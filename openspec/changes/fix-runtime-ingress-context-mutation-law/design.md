## Context

The attention model now has two independent dimensions:

- item/detail truth: immutable commit history, score vectors, and source provenance
- context summary truth: the current mutable `attentionContext` projection

Runtime ingress is mostly source fact ingestion. A source fact should usually create or update an attention item, but it should not rewrite the context summary unless that context is explicitly a source-owned projection.

## Decisions

### Decision 1: Runtime drafts default to preserve

`AttentionDraft` is the runtime's source-ingress carrier. If a draft does not declare `contextMutation`, the runtime will treat it as `preserve`. This makes source fact ingestion safe by default.

Explicit Avatar/tool commits remain outside this default and keep the attention kernel's compatible `apply` behavior.

### Decision 2: Runtime system envelopes default to preserve

`RuntimeSystemIngressEnvelope` also carries source facts from adapters. The envelope-to-draft bridge will default missing `contextMutation` to `preserve`.

This covers follow-up reminders, room lifecycle, terminal snapshots/diffs, and future adapter ingress without adding source-specific branches.

### Decision 3: Skill outline is an explicit apply exception

The runtime skill publish context is not an Avatar-authored topic summary; it is the skills outline itself. Skill snapshot ingress will therefore explicitly declare `contextMutation: "apply"`.

Skill change reminder ingress remains an item/detail fact. It may wake attention, but it should not rewrite the outline unless the generated outline also changed.

### Decision 4: Skill outline equality ignores internal implementation details

The skill attention context should be driven by skill name and description. Runtime skill refresh will continue to compute the full snapshot for API/debug consumers, but it will publish context-changing skill outline ingress only when the generated outline text changes.

Internal watched files, references, config, and path-level churn can still create skill-change items when they are relevant, but they will not rewrite the skills outline context by themselves.

## Alternatives Rejected

- Add `contextMutation: "preserve"` at every current caller only. Rejected because future source ingress would silently reintroduce the same bug.
- Change the attention kernel default from `apply` to `preserve`. Rejected because that would break direct attention commits and legacy callers that intentionally use commit changes as context updates.

## Risks

- Some tests may have relied on source fact detail becoming current context content. Those tests should be updated to assert commit history/detail instead of context mutation.
- A future source-owned projection must opt in to `apply`; this is intentional and should be documented at the call site.
