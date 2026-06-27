## Cleanup Audit

Date: 2026-05-26

## Before

Inspected:

- `~/Dev/GitHub/jixoai-labs/agenter/.agenter`
- `~/.agenter`

## Delete Plan

Delete obsolete workspace prompt/root residue:

- `~/Dev/GitHub/jixoai-labs/agenter/.agenter/AGENTER.mdx`
- `~/Dev/GitHub/jixoai-labs/agenter/.agenter/avatars/by-principal/0x888bb66a5ec389d52df0c9ff3e19a61dec890a66/AGENTER.mdx`
- `~/Dev/GitHub/jixoai-labs/agenter/.agenter/avatar/jarredsumner/AGSTENR.mdx`
- `~/Dev/GitHub/jixoai-labs/agenter/.agenter/avatar/jane/AGSTENR.mdx`

Delete obsolete nested runtime/workspace residue:

- `~/Dev/GitHub/jixoai-labs/agenter/.agenter/.agenter`
- `~/Dev/GitHub/jixoai-labs/agenter/.agenter/Library/Caches`
- `~/.agenter/avatars/by-principal/0x888bb66a5ec389d52df0c9ff3e19a61dec890a66/.agenter`
- `~/.agenter/avatars/by-principal/0x1269f34e1a88fe6a0314f777a049a7a0cf302622/.agenter`
- `~/.agenter/avatars/by-principal/0x5e393787887978177a444dfd1aee4e28eb2a7c10/.agenter`

Preserve:

- `~/.agenter/avatars/by-principal/0x888bb66a5ec389d52df0c9ff3e19a61dec890a66/AGENTER.mdx`
- workspace memory/skills/tools/archive directories under `~/Dev/GitHub/jixoai-labs/agenter/.agenter/workspace`
- workspace-private memory/skills/tools/archive data under `~/Dev/GitHub/jixoai-labs/agenter/.agenter/avatars/by-principal/**`
- global Avatar roots under `~/.agenter/avatars/by-principal/**`

## After

Deleted the obsolete paths listed above.

Verified:

- `~/Dev/GitHub/jixoai-labs/agenter/.agenter` has no remaining `AGENTER.mdx`, `AGSTENR.mdx`, nested `.agenter/.agenter`, or repo-local `Library/Caches` entries.
- `~/.agenter/avatars/by-principal/**` has no remaining nested `.agenter` directories at the audited depth.
- global canonical prompt `~/.agenter/avatars/by-principal/0x888bb66a5ec389d52df0c9ff3e19a61dec890a66/AGENTER.mdx` still exists.
- `~/Dev/GitHub/jixoai-labs/agenter/.agenter` is now 136K after cleanup.
- a temporary AppKernel smoke run with both global and workspace-local prompt files confirmed runtime reads the global `AGENTER.mdx` and ignores the workspace prompt residue.
