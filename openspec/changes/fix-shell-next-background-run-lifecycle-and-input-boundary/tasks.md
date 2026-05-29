## 1. BDD Regression Coverage

- [x] 1.1 Add failing BDD coverage for `Run in Background` preserving the attached terminal binding on the next attach.
- [x] 1.2 Add failing BDD coverage for `Terminate terminal` still disposing the attached terminal source and killing the PTY.
- [x] 1.3 Add failing BDD coverage for the terminal input ownership audit so app/view code cannot regain terminal-specific semantics.

## 2. Exit-Mode Plumbing

- [x] 2.1 Add an explicit shell-next exit outcome for close-confirm background vs terminate.
- [x] 2.2 Thread that exit outcome through the product attach/runtime path so background exit and terminate do not share the same teardown path.
- [x] 2.3 Keep background exit from performing destructive terminal cleanup.

## 3. Input-Boundary Audit

- [x] 3.1 Inspect shell-next app/view handlers and classify each input path as product-global, raw forwarding, or terminal-semantic ownership.
- [x] 3.2 Remove or relocate any terminal-specific mouse/keyboard semantics that still live above the source/backend boundary.
- [x] 3.3 Keep `extensions/cli-shell` untouched.

## 4. Verification And Self Review

- [x] 4.1 Run focused shell-next BDD for background-run vs terminate lifecycle.
- [x] 4.2 Run focused shell-next BDD for the input-boundary audit.
- [x] 4.3 Run `bun run --filter 'agenter-ext-shell-next' test`.
- [x] 4.4 Run `bun run --filter 'agenter-ext-shell-next' typecheck`.
- [x] 4.5 Run `git diff --check`.
- [x] 4.6 Merge the review notes into one drift list and one future-task list in plain language.
