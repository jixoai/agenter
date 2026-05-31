## Context

The latest Avatar topology separates Avatar identity from workspace locality. The global Avatar catalog owns the Avatar definition, and the canonical Avatar runtime home is the principal-address root under the user's global `.agenter` directory. A regular workspace may hold workspace-specific data or mounted resources, but it does not own a copied Avatar prompt definition.

The current implementation still contains old prompt/root assumptions:

- `session-config` can prefer a workspace avatar root for `prompt.rootDir`, `prompt.privateRootDir`, and `prompt.agenterPath`.
- app prompt seed can take `workspacePath` and write `AGENTER.mdx` under a workspace-local principal root.
- client-sdk and cli-shell still pass or model `workspacePath` for prompt seed.
- specs and tests still describe or assert workspace prompt roots.
- local filesystem residue under the repo `.agenter` and the user's `~/.agenter` can keep the old design confusing during manual verification.

## Decisions

### 1. `AGENTER.mdx` source is global-only

The runtime prompt entry point is always:

```txt
~/.agenter/avatars/by-principal/<principalId>/AGENTER.mdx
```

`<workspace>/.agenter/avatars/by-principal/<principalId>/AGENTER.mdx`, workspace root `.agenter/AGENTER.mdx`, nickname aliases, session-local prompt paths, and settings prompt paths cannot become runtime prompt truth.

### 2. App prompt seed is not workspace-scoped

App seed-if-missing remains legal, but only for the global Avatar prompt. The prompt seed input must not expose `workspacePath`. Existing app memory or workspace-private asset APIs are separate concerns and stay outside this prompt/root change.

### 3. Runtime identity must not accidentally use a workspace seat principal as prompt identity

Changing the path helper is not enough if the `<principalId>` comes from a workspace seat record. The implementation must audit whether `session.avatarPrincipalId` represents the global Avatar principal or a workspace seat principal. If both identities are needed, they must be modeled as separate fields instead of reusing one id for both prompt root and workspace credentials.

### 4. Slot remains a neutral syntax tool

This change must not add `AGENTER.mdx` special cases to Slot parsing or composition. Slot should continue to operate from the path/root context provided to the prompt store. The refactor changes the prompt entry root, not Slot's own semantics.

### 5. Local cleanup is an operator task, not a runtime dependency

Runtime correctness must not depend on deleting local residue. After the law is encoded and tests prove workspace prompt files are ignored, this change includes a manual cleanup task for this development machine:

- inspect `~/Dev/GitHub/jixoai-labs/agenter/.agenter`
- inspect `~/.agenter`
- identify obsolete workspace-local `AGENTER.mdx` prompt roots and stale aliases created by the old design
- delete or move only files that are no longer valid prompt truth
- preserve global canonical Avatar prompts and any non-prompt data whose ownership is outside this change

The cleanup must record before/after evidence so it is clear what was deleted and why.

## Non-Goals

- Do not redesign memory pack ownership.
- Do not redesign workspace skill discovery.
- Do not change Slot syntax or parser behavior.
- Do not delete user data automatically from runtime code.
- Do not fold this change into cli-shell tmux/rendering work.
