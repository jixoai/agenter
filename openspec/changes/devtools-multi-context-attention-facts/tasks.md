## 1. Frontend contract capture

- [x] 1.1 Add a delta spec for `workspace-devtools-surface` covering multi-context attention fact presentation
- [x] 1.2 Document the frontend consumption and verification design for multi-context attention facts

## 2. Cycle Inspector adaptation

- [x] 2.1 Preserve context-level metadata when flattening `attention-system-active.contexts[].items[]`
- [x] 2.2 Render readable context ownership in Cycle Inspector attention item headers

## 3. Frontend proof

- [x] 3.1 Add or update Storybook stories that exercise multi-context attention facts in Devtools
- [x] 3.2 Add Storybook DOM verification that asserts the expected multi-context summary and ownership labels
- [x] 3.3 Run focused frontend verification for the Cycle Inspector stories and update this task list from evidence

## Verification Notes

- `bun run --filter '@agenter/webui' test:dom -- test/storybook/cycle-inspector-panel.stories.test.tsx`
- `bun run --filter '@agenter/webui' build`
