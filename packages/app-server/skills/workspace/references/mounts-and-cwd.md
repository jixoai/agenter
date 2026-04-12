# Mounts and cwd

`workspace list` tells you:

- which workspaces are mounted
- which absolute paths are granted
- whether a path is `ro` or `rw`

Use that output to decide where work should happen.

Rules:

- If both avatar-root and a project workspace are mounted, pass an explicit absolute `cwd` to `terminal create`.
- Do not invent virtual aliases for paths.
- If a path is not granted, do not assume you can write there.
