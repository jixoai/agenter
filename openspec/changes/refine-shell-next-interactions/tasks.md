## 1. OpenSpec And BDD Setup

- [x] 1.1 Validate the new `refine-shell-next-interactions` OpenSpec artifacts before implementation.
- [ ] 1.2 Add failing BDD scenarios for shared button affordances, statusbar bracketed actions, and Chat title active underline.
- [ ] 1.3 Add failing BDD scenarios for resize handle click behavior and terminal resize debounce/coalescing.
- [ ] 1.4 Add failing BDD scenarios for close-confirm visible-cell hit testing.
- [ ] 1.5 Add failing BDD scenarios for ShellPane and renderer-pane copy routing.

## 2. Interaction Platform Implementation

- [ ] 2.1 Implement shared bracketed action styling for pane-title and statusbar actions.
- [ ] 2.2 Update Chat title actions and statusbar Help/Chat actions to use underline active state and scoped bold hover state.
- [ ] 2.3 Implement one-cell click resize for horizontal and vertical resize handles while preserving drag resize.
- [ ] 2.4 Implement debounced, coalesced terminal backend resize delivery in the terminal pane projection.
- [ ] 2.5 Fix close-confirm top-layer hit regions so visible button cells match clickable cells.
- [ ] 2.6 Fix source-family-aware copy routing for ShellPane and renderer panes.

## 3. Self Review

- [ ] 3.1 Self review round 1: compare implementation against the seven original feedback bullets and record any remaining gap.
- [ ] 3.2 Self review round 2: inspect event ownership, hit-region coordinates, copy paths, and resize delivery for architectural drift.
- [ ] 3.3 Update OpenSpec tasks to reflect actual completion state without marking unverified work done.

## 4. Verification And Commit

- [ ] 4.1 Run `openspec validate refine-shell-next-interactions --strict`.
- [ ] 4.2 Run `bun run --filter 'agenter-ext-shell-next' test`.
- [ ] 4.3 Run `bun run --filter 'agenter-ext-shell-next' typecheck`.
- [ ] 4.4 Run `git diff --check`.
- [ ] 4.5 Stage only shell-next and `refine-shell-next-interactions` files, then create a focused commit.
