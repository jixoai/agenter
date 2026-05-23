## Why

The previous fix separated message attention items from Avatar-owned room context, but the runtime still leaves `contextMutation` optional on most ingress paths. Optional means the attention kernel falls back to `apply`, so follow-up reminders, room lifecycle facts, task updates, terminal snapshots, and other source facts can still rewrite an `attentionContext` that should be owned by the Avatar.

This repeats the same category error in a broader form: an objective source fact becomes the mutable context summary instead of remaining an item/detail fact.

## What Changes

- Runtime source/draft ingress defaults to context-preserving commits.
- Follow-up reminder, room lifecycle, task, and terminal ingress preserve context while still producing commits, scores, and history.
- Direct Avatar/tool attention commits keep their existing ability to apply context changes.
- Runtime skill outline ingress explicitly applies to the skill context because that context is the skills outline.
- Runtime skill outline publication is de-noised so internal skill file changes only rewrite context when the generated name/description outline changes.

## Impact

- Affected packages: `@agenter/app-server`.
- Affected specs: `runtime-system-boundary-law`, `runtime-system-kernel-adapters`, `runtime-skill-system-surface`.
- Compatibility: existing persisted attention commits remain readable; the new default only affects newly produced runtime source ingress.
