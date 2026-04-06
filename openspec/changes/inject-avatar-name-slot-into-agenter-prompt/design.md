## Context

The prompt platform already supports MDX `<Slot name="..."/>` expansion through `PromptBuilder`. The bug is not missing infrastructure; it is that `AGENTER_SYSTEM` still hardcodes `agenter-ai`, and the runtime does not pass avatar identity into shared prompt documents before composing `SYSTEM_TEMPLATE`.

This change crosses localized prompt docs plus the app-server runtime, so the design needs to make the contract explicit: prompt identity is a platform slot, not ad hoc text replacement.

## Goals / Non-Goals

**Goals:**

- Make shared system prompts reflect the current runtime avatar identity.
- Reuse the existing `<Slot />` prompt primitive instead of introducing a second variable system.
- Preserve current behavior for runtimes that do not provide a specific avatar name by falling back to the existing default label.

**Non-Goals:**

- Redesign persona storage or introduce a broader prompt-variable registry.
- Change user overlays beyond allowing them to consume the same `AVATAR_NAME` slot if they choose.
- Modify database state or message persistence.

## Decisions

### 1. Use `<Slot name="AVATAR_NAME" />` inside localized prompt docs

The hardcoded assistant name lives in localized `AGENTER_SYSTEM` documents, so the correct fix is to turn that identity into a prompt slot at the document layer. This keeps localization and prompt authorship as the single source of truth.

Alternative considered: `$AVATAR_NAME` string replacement. Rejected because the platform already has an MDX slot primitive, and adding a second templating mechanism would duplicate prompt law.

### 2. Inject avatar identity while building shared prompt documents

`AgenterAI` will pass `slots: { AVATAR_NAME: ... }` when rendering `AGENTER_SYSTEM` and `AGENTER` before those documents are inserted into `SYSTEM_TEMPLATE`. This keeps document-level slots orthogonal to the outer template slots and allows future overlay docs to consume the same identity without more runtime glue.

Alternative considered: inject only at the final `SYSTEM_TEMPLATE` layer. Rejected because nested documents would still carry unresolved identity placeholders or require brittle post-processing.

### 3. Keep the default fallback as `agenter-ai`

If the runtime does not provide an explicit avatar name, the system should still render a stable identity. Reusing the existing default preserves backward behavior for non-avatar contexts while allowing room avatars to override it.

## Risks / Trade-offs

- [Risk] Custom prompt overlays may continue to hardcode a name. → Mitigation: shared defaults switch to `AVATAR_NAME`, and runtime injection is available to any overlay document that adopts the slot.
- [Risk] Prompt tests may only validate raw docs and miss final runtime composition. → Mitigation: update both prompt-store tests and `AgenterAI` runtime tests.
- [Risk] Future prompt docs may need more identity fields. → Mitigation: keep the contract slot-based so additional fields can reuse the same mechanism instead of introducing new templating rules.

## Migration Plan

1. Add the OpenSpec delta for avatar-aware prompt composition.
2. Update localized prompt docs to use `AVATAR_NAME`.
3. Thread `avatarName` through `SessionRuntime -> AgenterAI -> PromptBuilder`.
4. Update targeted tests and durable capability spec.

Rollback is straightforward: revert the prompt doc and runtime injection changes. No storage migration is involved.

## Open Questions

- None for this change.
