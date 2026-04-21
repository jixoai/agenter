## Context

The workspace kernel already knows how to mount multiple workspaces and execute one-shot bash inside one granted workspace. The problem is not the low-level shell primitive. The problem is the platform law around it:

- the model still only sees root tools
- runtime-local system CLI is implicitly tied to the root shell
- mounted workspaces have no stable AI-facing numeric handle
- alias/display metadata is not part of durable mount truth
- trace/UI layers only know the command text and lose the workspace identity that produced it

This change intentionally does **not** solve the deeper future architecture where mounted workspaces load System instances from `settings.local.json` and dynamically publish AttentionContexts. That future law needs a separate change because it introduces secret distribution, system lifecycle, and context-mount semantics that are larger than the current shell refactor.

## Goals / Non-Goals

**Goals**

- Make mounted project workspaces first-class direct tool targets through `workspace_list` and `workspace_bash`.
- Keep root-only system control explicit through `root_bash`.
- Give each runtime-held workspace a stable runtime-local numeric id, mutable alias, and default cwd.
- Preserve workspace isolation: one `workspace_bash` invocation sees only its own workspace authority.
- Persist enough workspace metadata that re-attach/restart does not cause alias/id drift for the same runtime mount.
- Preserve request-body and heartbeat evidence so the executed workspace can be reconstructed from persisted facts.
- Delete active `root_workspace_*` references instead of leaving compatibility glue.

**Non-Goals**

- Do not inject runtime-local system CLI into every mounted workspace shell.
- Do not unify `root_bash` and `workspace_bash` behind fake symmetry such as `workspace_bash(id=root)`.
- Do not add more direct tools for alias mutation or system control.
- Do not implement the future mounted-system-from-settings law in this change.

## Decisions

### 1. Direct tool surface becomes three explicit primitives

The model will receive exactly three direct tools:

- `workspace_list`
- `root_bash`
- `workspace_bash`

Why three tools instead of `workspace_list + workspace_bash` only:

- today the root shell still owns the credential-bearing runtime-local system CLI
- pretending every workspace has that same control plane would be false
- an explicit `root_bash` keeps the current special law honest while still letting mounted workspaces become direct shell targets

### 2. `workspace_list` exposes only mounted project workspaces

`workspace_list` returns:

```ts
Array<{
  id: number;
  cwd: string;
  alias: string;
}>
```

It intentionally excludes the avatar root workspace. Root remains separately reachable through `root_bash`.

Why:

- it avoids fake symmetry that would imply root can already be treated like an ordinary mounted workspace
- it keeps the model’s workspace-selection surface focused on project workspaces
- it matches the user’s correction that root-only system control is still special today

The runtime-local `workspace` CLI/API may return richer data, including `path`, `kind`, and grants, but the direct tool stays minimal.

### 3. Mount metadata lives on `WorkspaceMountRecord`

Each runtime mount gains:

- `runtimeWorkspaceId: number`
- `alias: string`

The default alias law:

- `avatar-root` -> `root`
- project workspace -> last two non-empty path segments, or basename fallback

The mount also continues to own the exec profile that provides default `cwd`.

Why mount-level instead of global workspace-level:

- aliases are presentation choices for one runtime, not global workspace truth
- different runtimes may legitimately use different labels for the same path
- the user explicitly asked for alias duplication to be allowed

### 4. Reattach reuses existing runtime-local id and alias

If a runtime detaches and later re-attaches the same workspace path and mount kind, the store reactivates the detached mount record instead of inventing a new id/alias. This preserves:

- AI-facing workspace ids
- alias choices
- exec profile / default cwd

Why:

- otherwise the numeric handle would drift for the same runtime-held workspace, weakening the point of a runtime-local id

### 5. `workspace_bash` stays a pure workspace shell

`workspace_bash`:

- resolves a mounted workspace by runtime-local id
- uses `executeWorkspaceBash(...)`
- runs one isolated `just-bash` session per invocation
- has no runtime-local system CLI, no root token, and no root-only env injection

It still exposes workspace public/private asset roots and workspace tool scripts under that workspace’s grant law.

### 6. `root_bash` keeps system CLI and root authority

`root_bash` is the only direct shell with:

- runtime-local `attention/message/workspace/terminal/skill/tool` CLI
- injected principal/private-key based root control-plane access
- root workspace filesystem authority

This is an explicit transitional law, not a hidden compatibility shim.

### 7. Runtime `workspace` descriptor gains alias mutation

The runtime-local `workspace` namespace gains a `set-alias` descriptor:

```json
{
  "workspaceId": 1,
  "alias": "frontend"
}
```

This mutation is reachable through `root_bash` only, because it is runtime control-plane work.

The existing `workspace list` descriptor becomes the richer inspection surface for mounted workspace metadata.

### 8. Trace persistence must snapshot workspace identity at execution time

Heartbeat/tool traces must persist:

- tool name
- `workspaceId` when applicable
- `workspaceAlias`
- `command`

Why:

- alias is mutable over time
- WebUI should show the alias that was true when the command ran, not whatever the alias became later

### 9. Runtime guidance is split by shell role

Built-in runtime guidance will teach:

- `workspace_list` to discover mounted project workspaces
- `root_bash` for runtime control/system CLI
- `workspace_bash` for pure workspace file/command work

It must stop implying that every workspace shell already hosts the same system control plane.

## Risks / Trade-offs

- [Partial symmetry] keeping `root_bash` special is not the final ideal law, but it is the truthful current law.
- [Wide cleanup] `root_workspace_*` appears in many tests, generated skills, and specs. The implementation must delete active references comprehensively.
- [Projection churn] some runtime/client preview fields still assume a `rootWorkspace` worldview. They need either replacement or removal to avoid semantic drift.
- [Alias drift in history] if traces do not snapshot alias at execution time, UI history will lie after rename operations.

## Migration Plan

1. Extend workspace mount persistence with runtime-local id and alias metadata plus alias mutation support.
2. Add `workspace_list`, `root_bash`, and `workspace_bash` direct tools in `session-runtime`.
3. Wire runtime-local `workspace list` and `workspace set-alias` descriptors/handlers through the root control plane.
4. Update projections, traces, and WebUI rendering to carry and display alias-aware workspace execution metadata.
5. Rewrite runtime guidance/specs/tests/generated artifacts away from `root_workspace_*`.
6. Run targeted verification and inspect real request-body/tool-trace evidence.

## Open Questions

- None for this change. The user explicitly chose the “root control stays explicit for now” path.
