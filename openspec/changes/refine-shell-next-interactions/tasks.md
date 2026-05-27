## 1. OpenSpec And BDD Setup

- [x] 1.1 Validate the new `refine-shell-next-interactions` OpenSpec artifacts before implementation.
- [x] 1.2 Add failing BDD scenarios for shared button affordances, statusbar bracketed actions, and Chat title active underline.
- [x] 1.3 Add failing BDD scenarios for resize handle click behavior and terminal resize debounce/coalescing.
- [x] 1.4 Add failing BDD scenarios for close-confirm visible-cell hit testing.
- [x] 1.5 Add failing BDD scenarios for ShellPane and renderer-pane copy routing.

## 2. Interaction Platform Implementation

- [x] 2.1 Implement shared bracketed action styling for pane-title and statusbar actions.
- [x] 2.2 Update Chat title actions and statusbar Help/Chat actions to use underline active state and scoped bold hover state.
- [x] 2.3 Implement one-cell click resize for horizontal and vertical resize handles while preserving drag resize.
- [x] 2.4 Implement debounced, coalesced terminal backend resize delivery in the terminal pane projection.
- [x] 2.5 Fix close-confirm top-layer hit regions so visible button cells match clickable cells.
- [x] 2.6 Fix source-family-aware copy routing for ShellPane and renderer panes.

## 3. Self Review

- [x] 3.1 Self review round 1: compare implementation against the seven original feedback bullets and record any remaining gap.
  - Round 1 result: all seven feedback bullets are covered by BDD tests or implementation changes. No remaining product gap found in this pass.
- [x] 3.2 Self review round 2: inspect event ownership, hit-region coordinates, copy paths, and resize delivery for architectural drift.
  - Round 2 result: pane/title events remain scoped to their visible hit regions; terminal and renderer copy paths stay source-family-aware; terminal backend resize is owned by the terminal projection and coalesces rapid layout updates.
- [x] 3.3 Update OpenSpec tasks to reflect actual completion state without marking unverified work done.

## 4. Verification And Commit

- [x] 4.1 Run `openspec validate refine-shell-next-interactions --strict`.
- [x] 4.2 Run `bun run --filter 'agenter-ext-shell-next' test`.
- [x] 4.3 Run `bun run --filter 'agenter-ext-shell-next' typecheck`.
- [x] 4.4 Run `git diff --check`.
- [x] 4.5 Stage only shell-next and `refine-shell-next-interactions` files, then create a focused commit.
