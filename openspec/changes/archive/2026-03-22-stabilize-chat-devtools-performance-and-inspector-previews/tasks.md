## 1. Route and transcript stabilization

- [x] 1.1 Refactor Chat projection so unchanged rows reuse stable row/message identities across unrelated runtime updates.
- [x] 1.2 Memoize Chat row/body subtrees and trim viewport structure keys/effects so read-only markdown surfaces stay mounted.
- [x] 1.3 Split Devtools into active-tab subtrees and move retained model/API stream work behind the model tab.

## 2. Structured inspection and loading states

- [x] 2.1 Add a lightweight `JSONViewer` with YAML-first, formatted-JSON, and raw-JSON modes plus menu-only local/global controls.
- [x] 2.2 Replace Cycle fact Markdown dumps with structured previews and list-item rendering for high-cardinality attention facts.
- [x] 2.3 Extend `AsyncSurface` so empty-loading can show explicit loading copy while ready-loading keeps restrained overlays.

## 3. Verification

- [x] 3.1 Add unit coverage for chat row stability, selector isolation, and JSONViewer mode resolution.
- [x] 3.2 Add Storybook DOM coverage for cycle fact YAML previews and async-surface four-state behavior.
- [x] 3.3 Run targeted `@agenter/webui` unit and DOM test suites, then update this task list from verified results.
