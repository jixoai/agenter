## Why

The new `attention-system-active` payload already ships multi-context attention facts to the frontend, but the frontend-side contract for consuming and validating that shape has not been captured in OpenSpec. That leaves Devtools adaptation code unowned and makes it hard to prove from the UI layer that multi-context attention remains readable and faithful to the runtime payload.

## What Changes

- Capture the frontend-facing Devtools contract for `attention-system-active` multi-context facts as a dedicated change.
- Make Cycle Inspector preserve context-level metadata such as context id, owner, item title, and score summary when flattening attention facts for display.
- Add Storybook DOM verification that proves multi-context attention facts remain readable in Devtools and do not regress into raw unreadable dumps.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `workspace-devtools-surface`: Devtools cycle facts now explicitly support multi-context attention payloads while preserving readable context ownership in the UI.

## Impact

- Affected code: `packages/webui/src/features/chat/cycle-facts.ts`, `packages/webui/src/features/process/CycleInspectorDetail.tsx`, `packages/webui/src/features/process/CycleInspectorPanel.stories.tsx`, `packages/webui/test/storybook/cycle-inspector-panel.stories.test.tsx`
- Affected APIs: frontend consumption of `attention-system-active` cycle facts
- Verification: Storybook DOM contract and focused WebUI build/test coverage
