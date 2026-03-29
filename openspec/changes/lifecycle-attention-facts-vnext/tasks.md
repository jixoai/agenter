## 1. Lifecycle attention policy

- [ ] 1.1 Add a shared lifecycle-event policy helper for room and terminal runtime mutations.
- [ ] 1.2 Promote room `create/update/archive` and terminal `create/delete/config_update` to active lifecycle attention.
- [ ] 1.3 Keep room/terminal focus transitions as passive lifecycle facts.

## 2. Terminal lifecycle closure

- [ ] 2.1 Record both `terminal_focus` and `terminal_unfocus` transitions from before/after focus sets.
- [ ] 2.2 Emit lifecycle commits for `terminal_set_config` in `ctx-terminal-control-plane`.
- [ ] 2.3 Keep boot-time terminal hydration free of synthetic lifecycle commits.

## 3. Verification

- [ ] 3.1 Add/update backend tests for room lifecycle active attention and terminal lifecycle gaps.
- [ ] 3.2 Run targeted app-server regressions and typecheck.
