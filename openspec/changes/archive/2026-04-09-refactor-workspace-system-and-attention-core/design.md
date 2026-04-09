## Context

The current repository still encodes the older `workspace + avatar = session/runtime` law in multiple places:

- `packages/app-server/src/session-identity.ts` derives runtime/session ids from the workspace/avatar pair.
- `packages/app-server/src/avatar-catalog.ts` and `packages/avatar/src/avatar.ts` still treat workspaces as avatar override roots.
- `packages/app-server/src/session-notifications.ts` keeps an attention-adjacent notification registry instead of using attention as the ingress truth.
- `packages/attention-system` contexts do not yet own any durable focus/background/muted state.
- `packages/webui` still presents `Workspace` as a fixed tab inside `Avatars`, which mirrors the old coupling rather than the desired system boundaries.

The user decisions for this change are explicit:

- no backward compatibility;
- no legacy data migration;
- no continued use of the old singular `.agenter/avatar/*` layout;
- one canonical runtime per Avatar;
- WorkspaceSystem owns public and avatar-private workspace assets;
- WorkspaceSystem uses `just-bash` as a sandboxed bash execution kernel, but TerminalSystem remains the separate interactive/long-running system;
- `AttentionContext` becomes the single truth for focus state, and source adapters consume that state through one-way hooks.

## Goals / Non-Goals

**Goals:**
- separate Avatar, AvatarRuntime, and Workspace into orthogonal durable models;
- make WorkspaceSystem the canonical authority for mounts, grants, and workspace bash execution;
- make attention focus-aware so `commit` and `push` ingress become first-class runtime facts;
- remove the second notification truth and derive shell notification surfaces from attention;
- publish backend contracts and verification harnesses that a later frontend change can consume directly.

**Non-Goals:**
- preserving old workspace+avatar runtime ids or old avatar directory compatibility;
- migrating historical sessions, attention state, or workspace-local avatar overlay data;
- replacing TerminalSystem with workspace bash execution;
- implementing future “invisible/override presence” tools in this change.

## Decisions

### AvatarRuntime is keyed by Avatar identity, not by workspace/avatar pairs

The runtime identity law becomes `one Avatar -> one canonical AvatarRuntime`. Workspaces, rooms, and terminals are attached to that runtime as dynamic mounts instead of creating new runtime identities.

Why:
- it matches the product goal that one Avatar can control multiple workspaces at once;
- it removes the artificial requirement that workspace membership must define runtime identity;
- it makes future Avatar-to-Avatar collaboration compositional instead of pairwise.

Rejected alternative:
- keep `workspace + avatar` as the durable runtime key and bolt multi-workspace support on top. This preserves the wrong identity law and guarantees more glue later.

### WorkspaceSystem becomes an independent platform system

Workspace logic moves into a new system boundary with its own domain objects and APIs:

- `Workspace`
- `WorkspaceMount`
- `WorkspaceGrant`
- `WorkspaceExecProfile`
- workspace public and avatar-private asset roots

The system owns:
- mount/unmount lifecycle;
- path-level `ro` / `rw` grants;
- workspace public assets;
- workspace avatar-private assets;
- sandboxed bash execution.

Why:
- workspace rules are no longer just “where an avatar is launched from”;
- grants and assets need their own durable truth;
- keeping these rules in avatar/session/config code would continue the current law collision.

Rejected alternative:
- keep workspaces as a sub-feature of avatar/session APIs. This would preserve the same hard coupling that caused the current architecture to drift.

### Workspace bash execution uses `just-bash`, not TerminalSystem

WorkspaceSystem exposes a non-interactive sandboxed `bash exec` capability powered by `just-bash`.

The contract is:
- each exec gets isolated shell state;
- filesystem side effects persist across execs;
- mounts enforce the workspace grant model;
- `tools/` scripts become discoverable `tool_*` commands through shebang-aware execution.

TerminalSystem remains the only authority for interactive TUI sessions, long-running process buffers, and collaboration-oriented terminal state.

Why:
- the user requirement explicitly distinguishes workspace bash from interactive terminal usage;
- `just-bash` matches the mount/grant model directly;
- it avoids shoving long interactive buffers into the attention/context path.

Rejected alternative:
- reuse TerminalSystem as the workspace execution primitive. That would bring interactive process semantics, buffer growth, and collaboration laws into a capability that is meant to stay small and sandboxed.

### Filesystem contract is replaced instead of migrated

The new durable layout is:

- global avatars: `~/.agenter/avatars/{avatar}/`
- workspace public assets: `$WORKSPACE/.agenter/workspace/{skills,memory,tools,archive}/`
- workspace avatar-private assets: `$WORKSPACE/.agenter/avatars/{avatar}/{skills,memory,tools,archive}/`

Legacy singular paths and old workspace-local avatar overlay directories are not migrated and not kept as compatibility aliases.

Why:
- compatibility would preserve the old conceptual model in the implementation;
- the user explicitly chose replacement over migration;
- this is a law reset, not a compatibility exercise.

### AttentionContext owns focus state and ingress type

`AttentionContext` gains durable focus state, with an initial model of:
- `focused`
- `background`
- `muted`

Attention ingress is split into:
- `commit`: external -> internal ingress for focused contexts;
- `push`: external -> internal ingress for non-focused contexts.

Both ingress types are durable attention facts. WebUI notification chrome is projected from attention state and ingress history rather than from a second notification writer.

Why:
- focus needs to belong to attention itself if attention is the scheduling law;
- background notifications are not a separate system, but they are semantically different from focused work;
- this allows one-way projection into source-specific presence/status without making those systems the truth.

Rejected alternative:
- keep focus in MessageSystem/TerminalSystem and feed it back into attention. That leaves attention as a passive ledger rather than the actual control plane.

### Source adapters consume one-way attention focus hooks

MessageSystem and TerminalSystem will consume attention-derived focus state through hooks that produce adapter-local derived state such as:
- room availability / engagement;
- terminal collaboration availability.

Those projections remain one-way. Adapters may later offer explicit override tools, but those overrides are not themselves the durable focus truth.

Why:
- the user explicitly wants attention as the single source of truth;
- source presence has transport/collaboration details that attention should not have to model directly;
- one-way projection keeps adapter complexity isolated.

### Notification projection is derived from attention, not maintained separately

The current `SessionNotificationRegistry` is removed as a truth source. Shell unread counts, preview cards, and push surfaces are derived from attention `push` ingress plus focus/visibility consumption hooks.

Why:
- a second writer for notification state creates drift against attention history;
- once push ingress exists inside attention, the extra registry is redundant;
- derived notification surfaces still support WebUI badges, previews, and future native/browser notification adapters.

Rejected alternative:
- keep dual systems and “sync” them. That would reintroduce the exact duplication this refactor is trying to eliminate.

### Frontend reassembly is explicitly out of scope for this phase

The original umbrella change included WebUI restructuring, but the current execution phase is backend-only by explicit user decision. This change therefore stops at backend truth, contracts, and verification harnesses.

Implications:
- backend modules SHALL NOT keep frontend-specific data shapes alive just to protect the old WebUI;
- the backend MUST publish enough runtime/workspace/attention contracts for a later frontend change;
- page composition, navigation, and desktop/mobile shells move to a separate frontend follow-up change.

## Risks / Trade-offs

- [Large breaking surface] -> Mitigation: keep this as a dedicated law-replacement change and do not mix backward-compatibility work into it.
- [Runtime terminology drift during implementation] -> Mitigation: allow temporary internal aliases (`SessionRuntime` -> `AvatarRuntime`) while external contracts move first.
- [`just-bash` command limitations] -> Mitigation: keep the workspace bash prompt/tooling explicit about sandbox scope and preserve TerminalSystem for interactive workloads.
- [WebUI IA churn across desktop/mobile] -> Mitigation: settle the shell and detail layouts in Pencil before implementation starts.
- [Source adapter hook regressions] -> Mitigation: add integration coverage around attention focus projection before deleting old notification/presence glue.

## Migration Plan

1. Introduce the new domain/storage contracts for AvatarRuntime, WorkspaceSystem, focus-aware AttentionContext, and push ingress.
2. Replace old runtime/session identity, avatar directory, and workspace path laws in app-server and shared packages.
3. Rewire MessageSystem and TerminalSystem to consume attention focus hooks and remove standalone notification truth.
4. Replace backend-facing API surfaces and verification harnesses with WorkspaceSystem and AvatarRuntime contracts.
5. Delete old singular avatar paths, workspace-local avatar overlay logic, and legacy notification/session identity glue.
6. Hand the resulting backend contracts to a separate frontend change.

## Open Questions

None at this stage. The remaining front-end detail work belongs in the Pencil design pass before implementation.
