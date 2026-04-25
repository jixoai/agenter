---
name: agenter-workspace
description: Inspect mounted real paths and choose the correct absolute cwd. Use this when path authority is unclear.
---

# agenter-workspace

Use this skill when you need to know which real paths are mounted and which absolute path should own the work.

Quick start:
1. Run `workspace list`.
2. Inspect mounted workspace paths and grant modes.
3. Choose an explicit absolute `cwd` when starting terminal work.

Key laws:
- The avatar root workspace is always mounted as the fixed root-workspace surface.
- Project access still depends on explicit workspace mounts and grants.
- Mounted project workspaces use public-workspace shell semantics even when they expose both shared and avatar-private files.
- Public-workspace shells do not inherit root-workspace-exclusive env/CLI by default.
- Real filesystem paths are the source of truth.

References:
- `references/mounts-and-cwd.md`: how to read mounts and choose the correct absolute working directory
