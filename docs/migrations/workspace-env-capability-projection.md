# Workspace Env Capability Projection Migration

This migration preserves user-owned skills while moving runtime authority from
`rootWorkspacePath/skills` to env-derived `SKILLS_HOME`.

## What Changed

- Workspace instance `AVATAR_HOME` is the durable avatar-private capability
  source. Empty `AVATAR_HOME` means avatar-private CLIs such as `note` are not
  projected.
- `SKILLS_HOME` is derived from workspace groups as
  `w1-pwd;w1-avatar-home;w2-pwd;w2-avatar-home;...`.
- Each PWD or Avatar-home base expands in this order:
  `<root>/skills`, `<root>/.codex/skills`, `<root>/.claude/skills`,
  `<root>/.agents/skills`.
- Later skill sources override earlier sources.

## Existing Skill Data

Old runtime installs may have user skills under the previous avatar layer:

```text
<rootWorkspacePath>/skills/<skill-name>/SKILL.md
```

If `<rootWorkspacePath>` is the workspace instance's active `AVATAR_HOME`, that
directory is still included through `SKILLS_HOME` as `<avatar-home>/skills`.
No copy is needed.

If the old path is not part of the workspace instance `AVATAR_HOME`, choose one
of these explicit migrations:

1. Add the old absolute root workspace path to the workspace instance
   `AVATAR_HOME`.
2. Move the skill directory into a currently projected source such as
   `<workspace>/skills` or `<avatar-home>/skills`.
3. Keep the old directory as archival data outside the active projection.

Do not rely on a hidden fallback from `rootWorkspacePath/skills`; the runtime no
longer treats that path as an implicit avatar skill authority when
`SKILLS_HOME` is available.
