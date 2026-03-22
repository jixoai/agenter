## 1. Renderer recovery

- [x] 1.1 Add proposal, design, and specs for terminal renderer recovery and terminal-id inspection
- [x] 1.2 Restore ANSI color fidelity and stable fit-driven sizing in `terminal-view`
- [x] 1.3 Add explicit `fit` / `cover` presentation controls to the integrated terminal surface

## 2. Terminal activity inspection

- [x] 2.1 Add terminal-id-based activity aggregation for reads/writes, tool calls/results, and attention facts
- [x] 2.2 Present the terminal page as renderer + activity inspector with independent scroll behavior
- [x] 2.3 Keep live transport from jittering or resetting backwards under snapshot fallback and resize changes

## 3. Verification

- [x] 3.1 Add terminal-view and WebUI regression tests for fit/cover, color fidelity, and stable live rendering
- [x] 3.2 Add Storybook DOM coverage for terminal activity filtering by terminal id
- [x] 3.3 Run targeted tests and update this task list from verified results
