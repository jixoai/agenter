# Runtime discovery

Use this note when you are orienting inside a fresh runtime.

Recommended order:
1. `workspace_list`
2. `skill list`
3. `skill info <skill>`
4. `skill get-config <skill>` when you need to inspect live watch targets
5. `<command> --help` for the exact CLI contract

Terminal-specific escalation:
- if you only forgot raw `terminal write` field names or compact indexes, start with `terminal write --help`
- if you need mixed syntax such as `<key .../>`, `<wait .../>`, or `<raw>...</raw>`, start with `terminal input --help`
- if raw vs mixed is still unclear after help, run `skill info agenter-terminal`
- from the real skill path, open `references/input-modes.md` first, then `references/file-writing.md` for multi-line or heavy-quoting patterns

How to expand a skill:
1. `skill info <skill>` prints the real `SKILL.md` path.
2. Derive the skill directory from that path.
3. Read only the needed sibling files under `references/`.
4. Use `skill get-config <skill>` if you need to inspect or retarget which extra files belong to that skill's live watcher truth.

Example:

```bash
skill_path="$(skill info agenter-terminal | sed -n 's/^Path: //p')"
skill_dir="$(dirname "$skill_path")"
cat "$skill_dir/references/input-modes.md"
```

Do not dump an entire references directory into context if you only need one file.
