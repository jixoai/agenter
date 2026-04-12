---
name: agenter-runtime
description: Orient yourself inside the runtime shell. Use this first when you need to choose between root tools, shell CLI, and deeper skill docs.
---

# agenter-runtime

Use this skill when you need to understand the runtime surface before choosing a more specific system skill.

Quick start:
1. Run `root_workspace_list`.
2. Run `ccski list`.
3. Run `ccski info <skill>`.
4. If a shell command rejects your arguments, run `<command> --help`.

Key laws:
- The only direct model tools are `root_workspace_list` and `root_workspace_bash`.
- `root_workspace_bash` is a one-shot shell, not a durable process owner.
- Long-lived or interactive work belongs in `terminal`.
- A local delivery URL may be verified from `root_workspace_bash`, but the process that owns that URL still belongs in `terminal`.
- A `terminal read` snapshot or a still-running process is not enough to prove a local delivery URL is ready; use a fresh exact-path HTTP check from the one-shot shell.
- When a room or user names a concrete local URL, scheme, host, port, and path are all part of the delivery contract.
- `ccski info` returns the real filesystem path to the skill's `SKILL.md`.
- Runtime-owned helper scripts are optional. Only inspect `~/tools` when `root_workspace_list` or the shell shows they actually exist.
- Helper scripts must not replace core work such as writing required workspace files or owning application network behavior.

References:
- `references/discovery.md`: progressive skill discovery and how to expand one skill at a time
- `references/shell-surface.md`: root tools, one-shot bash semantics, and bash vs terminal boundaries
- `references/toolbox.md`: optional runtime helper scripts under `~/tools` and the boundary for using them
