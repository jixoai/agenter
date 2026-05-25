## 1. Specs And Documentation

- [x] 1.1 Update durable cli-shell product spec with default-right, default-open, and popup/status-bar modal behavior.
- [x] 1.2 Update `extensions/cli-shell/SPEC.md`, README, and Help panel copy so user-facing docs match the product law.

## 2. Implementation

- [x] 2.1 Set built-in product settings default Chat layout to `right`.
- [x] 2.2 Make tmux attach auto-open/reuse the singleton Chat right pane.
- [x] 2.3 Normalize missing runtime tmux Chat default layout to `right`, not `cover`.
- [x] 2.4 Remove dead or misleading tmux plan roles introduced by the change.

## 3. Verification

- [x] 3.1 Add/update BDD tests for default settings, tmux attach, runtime action fallback, and Help copy.
- [x] 3.2 Run targeted cli-shell tests, cli-shell typecheck, and OpenSpec validation.
- [x] 3.3 Record the tmux popup/status-bar mouse behavior experiment result in the final report.
