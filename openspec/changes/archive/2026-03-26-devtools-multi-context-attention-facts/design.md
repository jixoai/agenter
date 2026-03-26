## Context

`attention-multi-context-mstc` upgrades the runtime payload from a flat `attention-system-list.items[]` structure to `attention-system-active.contexts[].items[]`. The WebUI already contains a partial adapter for that payload in Cycle Inspector, but this frontend work is not tracked in its own change and is not yet proven from a UI-facing contract.

Relevant existing contracts:
- `workspace-devtools-surface` already requires YAML-first fact readability and cycle-oriented technical inspection.
- `structured-value-preview` already defines lightweight YAML-first structured rendering.
- Current WebUI touch points are limited to Cycle fact summary, attention item flattening, and Storybook coverage for the Cycle Inspector surface.

## Goals / Non-Goals

**Goals**
- Define the Devtools requirement delta for multi-context attention facts.
- Keep flattened attention items readable by preserving context id and owner metadata.
- Add front-end proof through Storybook DOM tests that the Devtools surface presents multi-context attention facts as expected.

**Non-Goals**
- Change the backend payload contract again.
- Move attention facts into Chat.
- Redesign JSON/YAML viewer behavior outside the already adopted structured preview contract.

## Decisions

### Devtools remains the only frontend owner of multi-context attention facts
The multi-context payload is a technical fact surface, so it belongs in Devtools and Cycle Inspector rather than the Chat transcript.

Why: this preserves the product contract that Chat is user-facing while Devtools is technical.

### Flattening keeps context metadata alongside each item
Cycle Inspector will continue flattening `contexts[].items[]` into a list for rendering, but each rendered item must retain `_contextId` and `_owner` metadata so the user can still understand where the attention item came from.

Why: flattening without ownership loses the point of multi-context attention.

### Proof lives in Storybook DOM, not in comments
The verification artifact for this change is a Storybook DOM contract that exercises a multi-context cycle story and asserts the rendered context labels, ownership labels, and summary text.

Why: this is a frontend contract and should be proven through real DOM behavior.

## Risks / Trade-offs

- [UI proves only the consumed contract, not the whole runtime chain] -> acceptable because backend payload shape is covered by the attention/runtime tests in the other change.
- [Flattened rendering could still hide too much context] -> mitigate by rendering both context id and owner in the item header.

## Verification Plan

- Add a dedicated multi-context Cycle Inspector story.
- Add a Storybook DOM test that asserts:
  - summary text reflects multiple contexts,
  - each attention item still shows context ownership,
  - the structured viewer remains available for exact inspection.
- Run focused WebUI DOM verification for the Cycle Inspector story file.

## Handoff

This change is the frontend-side companion to `attention-multi-context-mstc`.
After it lands, the attention kernel change can be reviewed without silently carrying unowned WebUI behavior.
