---
name: agenter-runtime
description: Orient yourself inside the runtime shell. Use this first when you need to choose between root tools, shell CLI, and deeper skill docs.
---

# agenter-runtime

Use this skill when you need to understand the runtime surface before choosing a more specific system skill.

Quick start:

1. Run `workspace_list`.
2. If the task already names an exact room, path, URL, file, or terminal target, make one real command for that target before browsing deeper docs.
3. Run `skill list` only when you truly need a more specific skill family.
4. Run `skill info <skill>` only after the direct command path is still unclear.
5. Run `skill get-config <skill>` when you need to inspect which files define that skill's live watcher truth.
6. If a shell command rejects your arguments, run `<command> --help`.

Key laws:

- The only direct model tools are `workspace_list`, `root_bash`, and `workspace_bash`.
- `workspace_list` shows mounted project workspaces as `{ id, cwd, alias }`; root stays special and is reached through `root_bash`.
- `root_bash` is a one-shot shell for root control-plane work, not a durable process owner.
- `workspace_bash` is a pure mounted-workspace shell selected by `workspaceId`; it does not carry the root runtime-local control plane.
- `root_bash` also accepts optional `stdin`; for runtime-local CLI commands that take JSON payloads, default to `command=<bare action>` plus JSON `stdin`.
- Use a single argv JSON payload only when it is trivially short, single-line, and clearly cheaper in tokens than opening a separate `stdin` field.
- If `<command> --help` marks compact as `Suggested` or `Available`, `--compact` is also available as an optional positional array mode. If the array shape becomes unclear, fall back immediately to standard object JSON.
- `root_bash` can use outbound network access for objective verification of current or external facts.
- Long-lived or interactive work belongs in `terminal`.
- A local delivery URL may be verified from `root_bash`, but the process that owns that URL still belongs in `terminal`.
- A `terminal read` snapshot or a still-running process is not enough to prove a local delivery URL is ready; use a fresh exact-path HTTP check from the one-shot shell.
- When a room or user names a concrete local URL, scheme, host, port, and path are all part of the delivery contract.
- If the latest room message already contains the full task, do not pause the first real action just to reread the room or browse `SKILL.md`.
- `skill info` returns the real filesystem path to the skill's `SKILL.md`.
- `skill get-config` returns the skill config path plus the resolved watched files; `skill set-config` replaces that config JSON when you need to retarget skill live sync.
- Runtime-owned helper scripts are optional. Only inspect `~/tools` when `root_bash` or the shell shows they actually exist.
- Helper scripts must not replace core work such as writing required workspace files or owning application network behavior.

References:

- `references/discovery.md`: progressive skill discovery and how to expand one skill at a time
- `references/shell-surface.md`: root tools, one-shot bash semantics, and bash vs terminal boundaries
- `references/toolbox.md`: optional runtime helper scripts under `~/tools` and the boundary for using them
