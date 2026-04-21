---
name: agenter-terminal
description: Create, recover, and drive durable terminal sessions. Use this when work needs a long-lived or interactive process.
---

# agenter-terminal

Use this skill when work needs a durable process, an interactive shell, or recoverable terminal context.

Quick start:
1. Run `terminal list` when you need to recover or reuse an existing process owner.
2. Run `terminal create` when no suitable terminal exists yet.
3. Run `terminal write`.
4. Run `terminal read` only to inspect or recover terminal state.

Key laws:
- A runtime does not start with a terminal by default.
- Long-lived and interactive work belongs in terminals, not one-shot bash.
- If work needs a port listener, local web server, watch mode, REPL, or retryable boot sequence, start it in `terminal`.
- `terminal write` means the input was delivered, not that the process succeeded.
- After starting a listener in `terminal`, inspect its real state and verify the exact promised URL or path before you tell a room or user that it is ready.
- `terminal read` snapshots and "the process is still running" only describe terminal state; they do not prove the promised URL or API path actually responds.
- When the task already names the workspace and delivery target, the normal next move is to create or recover the terminal, not to browse unrelated room or attention detail first.
- If a one-shot shell hits binding or sandbox errors while you are trying to make a service reachable, stop and switch to `terminal`.
- When more than one workspace is mounted, choose an explicit absolute `cwd`.
- `terminal create`, `terminal write`, and `terminal read` are JSON-first commands. Through `root_bash`, default to `command=<bare terminal action>` plus JSON `stdin`.
- Only use a single argv JSON payload when it is trivially short and clearly cheaper in tokens than a separate `stdin` field.
- If `terminal create --help`, `terminal write --help`, or `terminal read --help` marks compact as `Suggested` or `Available`, the matching command also accepts `--compact` positional arrays. If the positional array becomes unclear, go straight back to standard object JSON.

References:
- `references/terminal-lifecycle.md`: create/list/read/write/kill strategy and recovery patterns
- `references/file-writing.md`: safe patterns for sending multi-line file writes through terminal input
