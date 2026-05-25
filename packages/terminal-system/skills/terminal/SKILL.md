---
name: agenter-terminal
description: Create, recover, and drive durable terminal sessions. Use this when work needs a long-lived or interactive process.
---

# agenter-terminal

Use this skill when work needs a durable process, an interactive shell, or recoverable terminal context.

Quick start:
1. Run `terminal list` first to inspect `processPhase`, `currentPath`, `currentTitle`, and prior stop facts before guessing lifecycle from stale output.
2. Run `terminal create` when no suitable terminal exists yet. Public `terminal create` auto-bootstraps by default, so a fresh terminal may briefly show `lifecycleTransition = bootstrapping` before it settles into `processPhase = running`.
3. If you need the durable launch command, launch cwd, geometry, or metadata, run `terminal get-config` instead of inferring config from observed runtime output.
4. If `terminal list` shows `processPhase` as `not_started`, run `terminal bootstrap` before expecting read/write to work. If the terminal was already killed, switch to `terminal history` and bootstrap it intentionally from there.
5. If `terminal list` or `terminal get-config` shows `lifecycleTransition = bootstrapping` or `killing`, wait and reread instead of stacking another lifecycle or config mutation.
6. Decide whether the next payload is `raw` or `mixed`.
7. If the exact payload shape is unclear, run `terminal write --help` or `terminal input --help` first.
8. Run `terminal write` for literal raw bytes, or `terminal input` for mixed DSL.
9. Run `terminal await` when you need to wait for bounded evidence such as output change, idle state, or a deterministic text match.
10. Run `terminal read` only for immediate inspection or recovery of current terminal state.
11. Run `terminal set-config` when the durable terminal identity is correct but launch truth needs to change for the next bootstrap.
12. Run `terminal stop` when you want to halt the PTY, remove it from the live list, and keep its durable history evidence for later bootstrap.

Key laws:
- A runtime does not start with a terminal by default.
- Long-lived and interactive work belongs in terminals, not one-shot bash.
- `terminal` is a collaborative process surface, not a root-workspace shell.
- Shared terminals keep real-home semantics and do not inherit root-workspace-exclusive env/CLI by default, even when `cwd` starts inside the avatar root workspace.
- `terminal list` is the lifecycle and observed-identity inspection surface. Read `processPhase`, `currentPath`, `currentTitle`, and stop facts there before inferring state from raw output.
- `terminal create` auto-bootstraps by default. A newly created terminal may briefly expose `lifecycleTransition = bootstrapping`; wait and reread instead of firing a redundant second bootstrap.
- Provisioned terminals do not auto-start when you read or write. Use `terminal bootstrap` explicitly.
- Killed terminals leave `terminal list`. Use `terminal history` to inspect dead-instance facts, and bootstrap only when you intentionally want to recover that same durable terminal.
- `terminal read` consumes this actor's read cursor. Other actors keep independent cursors on the same shared terminal output.
- Use `terminal read` deliberately: `remark:false` inspects without advancing your cursor, while normal reads advance only your actor's cursor.
- `terminal await` is the bounded observation primitive. Use it instead of reconstructing waits with shell `sleep`, repeated `terminal read`, and `grep`.
- `terminal await` returns clean bounded snapshot lines and match context from the terminal canvas. Those lines are evidence of the stable screen state, not raw ANSI bytes or PTY transition chunks.
- Prefer `terminal await`'s command-level `wait.timeoutMs` for post-mortem evidence. Shell-level `timeout` may still cancel the command, but it can prevent the JSON result from reaching you.
- `lifecycleTransition` is a coordination lock, not a work item. If it is `bootstrapping` or `killing`, wait and reread `terminal list` or `terminal get-config` before sending another lifecycle or config mutation.
- `terminal get-config` is the durable launch/config inspection surface. Use it for `command`, `launchCwd`, geometry, metadata, and other next-bootstrap truth.
- `terminal set-config` patches durable launch/config truth without changing the terminal id.
- For running PTYs, `cols` and `rows` may apply live immediately. Launch-affecting fields such as `command`, `launchCwd`, `env`, `processKind`, `gitLog`, and `logStyle` update durable truth first and take effect on the next bootstrap.
- If work needs a port listener, local web server, watch mode, REPL, or retryable boot sequence, start it in `terminal`.
- `terminal write` is raw mode. It sends literal bytes and never invents Enter, waits, or special keys for you.
- `terminal input` is mixed mode. Use it for `<key .../>`, `<wait .../>`, or literal `<...>` text wrapped in `<raw>...</raw>`.
- In mixed mode, literal tag-like lines must stay inside `<raw>...</raw>`, and Ctrl combos use `ctrl="true"` such as `<key data="d" ctrl="true"/>`.
- Interactive stdin programs usually split into two phases: start the program with `terminal write`, then feed content and special keys with `terminal input`.
- `terminal write` and `terminal input` only prove that input delivery succeeded; they do not prove the process succeeded.
- `terminal stop` halts the PTY, removes the terminal from the live list, and preserves durable history evidence. `terminal archive` hides dead history from the default work queue, and `terminal delete` is the final destructive removal.
- After starting a listener in `terminal`, inspect its real state and verify the exact promised URL or path before you tell a room or user that it is ready.
- `terminal read` snapshots and "the process is still running" only describe terminal state; they do not prove the promised URL or API path actually responds.
- When the task already names the workspace and delivery target, the normal next move is to create or recover the terminal, not to browse unrelated room or attention detail first.
- If a one-shot shell hits binding or sandbox errors while you are trying to make a service reachable, stop and switch to `terminal`.
- When more than one workspace is mounted, choose an explicit absolute `cwd`.
- `terminal create`, `terminal write`, `terminal await`, and `terminal read` are JSON-first commands. Through `root_bash`, default to `command=<bare terminal action>` plus JSON `stdin`.
- Only use a single argv JSON payload when it is trivially short and clearly cheaper in tokens than a separate `stdin` field.
- If `terminal create --help`, `terminal write --help`, `terminal input --help`, `terminal await --help`, or `terminal read --help` marks compact as `Suggested` or `Available`, the matching command also accepts `--compact` positional arrays. If the positional array becomes unclear, go straight back to standard object JSON.
- If raw vs mixed choice is unclear, read `references/input-modes.md` before guessing.
- If `terminal write --help` or `terminal input --help` still is not enough, run `skill info agenter-terminal`, derive the real skill directory, and read only the reference file you need.
- If the durable launch truth is unclear, read `references/terminal-config.md` before guessing.
- For multi-line writes, nested JSON, or heredoc-heavy payloads, the next file to open is `references/file-writing.md`.

References:
- `references/terminal-lifecycle.md`: create/recover/bootstrap/await/read/write/stop strategy and recovery patterns
- `references/terminal-config.md`: durable launch/config inspection and mutation rules
- `references/input-modes.md`: when to use raw vs mixed, and how `<raw>...</raw>` works
- `references/file-writing.md`: safe patterns for sending multi-line file writes through terminal raw/mixed input
