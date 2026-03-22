## 1. Persisted inspection stability

- [x] 1.1 Add proposal, design, and specs for cycle history and tool trace stabilization
- [x] 1.2 Update runtime-store clearing so persisted chat/cycle history survives pause and abort
- [x] 1.3 Preserve Devtools cycle rendering after lifecycle transitions

## 2. Tool trace normalization

- [x] 2.1 Merge tool-call and tool-result records into one cycle detail trace card
- [x] 2.2 Fix loading/done/failed status handling for merged tool traces
- [x] 2.3 Keep cycle timeline/detail scroll ownership stable in split and sheet modes

## 3. Verification

- [x] 3.1 Add runtime-store and WebUI regression tests for persisted cycle visibility after stop
- [x] 3.2 Add Storybook DOM coverage for merged tool traces and detail scrolling
- [x] 3.3 Run targeted tests and update this task list from verified results
