# Runtime discovery

Use this note when you are orienting inside a fresh runtime.

Recommended order:
1. `root_workspace_list`
2. `ccski list`
3. `ccski info <skill>`
4. `<command> --help` for the exact CLI contract

How to expand a skill:
1. `ccski info <skill>` prints the real `SKILL.md` path.
2. Derive the skill directory from that path.
3. Read only the needed sibling files under `references/`.

Example:

```bash
skill_path="$(ccski info agenter-terminal | sed -n 's/^Path: //p')"
skill_dir="$(dirname "$skill_path")"
ls "$skill_dir/references"
cat "$skill_dir/references/terminal-lifecycle.md"
```

Do not dump an entire references directory into context if you only need one file.
