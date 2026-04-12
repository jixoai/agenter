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
- The avatar root workspace is always mounted.
- Project access still depends on explicit workspace mounts and grants.
- Real filesystem paths are the source of truth.

References:
- `references/mounts-and-cwd.md`: how to read mounts and choose the correct absolute working directory
