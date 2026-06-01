---
name: agenter-runtime
description: Orient yourself inside the runtime shell. Use this first when you need to choose between root tools, shell CLI, and deeper skill docs.
---

# agenter-runtime

Use this skill when you need to understand the runtime surface before choosing a more specific system skill.

Quick start:

1. Run `workspace_list`.
2. Before the first substantive use of an internal runtime CLI family, read its corresponding skill with `skill info <skill>` when that skill exists.
3. If the task names an exact non-CLI file, URL, room, or terminal target, make a direct check for that target before browsing broader docs.
4. Run `skill list` only when you truly need to discover a more specific skill family.
5. Run `skill get-config <skill>` when you need to inspect which files define that skill's live watcher truth.
6. If a shell command rejects your arguments, run `<command> --help`.

Key laws:

- The only direct model tools are `workspace_list`, `root_bash`, and `workspace_bash`.
- `workspace_list` shows mounted project workspaces as `{ id, cwd, alias }`; the fixed avatar-root surface is reached through `root_bash`.
- `root_bash` is the fixed root-workspace shell: it rewrites `HOME` to the avatar root workspace and receives runtime CLI through workspace capability env such as `AVATAR_HOME` and `SKILLS_HOME`.
- `workspace_bash` is a public-workspace shell selected by `workspaceId`; it does not synthesize root-style `HOME` or receive runtime-local CLI merely because a project workspace is mounted.
- `root_bash` also accepts optional `stdin`; for runtime-local CLI commands that take JSON payloads, default to `command=<bare action>` plus JSON `stdin`.
- Use a single argv JSON payload only when it is trivially short, single-line, and clearly cheaper in tokens than opening a separate `stdin` field.
- If `<command> --help` marks compact as `Suggested` or `Available`, `--compact` is also available as an optional positional array mode. If the array shape becomes unclear, fall back immediately to standard object JSON.
- `root_bash` can use outbound network access for objective verification of current or external facts.
- `terminal` is a collaborative process surface, not a root-workspace shell; it keeps shared-terminal semantics and does not inherit runtime-local env/CLI by default.
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
