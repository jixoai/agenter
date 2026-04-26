## Context

Today the runtime models one fixed avatar-root workspace plus zero or more ordinary mounted workspaces. That workspace model is already partially explicit: mounts carry `kind: "avatar-root" | "workspace"`, shared/public workspace assets are separated from avatar-private workspace assets, and global terminals are modeled as cross-workspace resources rather than workspace-owned data.

What remains implicit is the surface law. The user wants code, comments, and UI to speak in two explicit semantic roles:

- `root-workspace`: the fixed avatar-root shell surface that can carry avatar-exclusive env and CLI
- `public-workspace`: the collaboration-oriented mounted workspace surface that may still expose public plus avatar-private files, but does not inherit root-exclusive env/CLI

The current environment model violates that distinction. `root_bash` explicitly rewrites `HOME` to the avatar root workspace, which is correct because that shell is the root-workspace control-plane surface. But runtime-created and recovered terminals currently reuse the same root-oriented environment assembly, so a shared terminal can end up with root-style `HOME`, root helper bins in `PATH`, and avatar-private runtime env even when the terminal is supposed to behave like a shared machine seat.

This mismatch already causes user-visible breakage. Tools such as `claude` resolve login/session state from the real home directory and fail when `HOME` is silently redirected into the avatar root workspace. More importantly, the root-workspace specialness is currently encoded as implementation reuse rather than as an explicit law.

## Goals / Non-Goals

**Goals:**

- make root-only env and CLI a root-workspace-only law
- keep `workspace_bash` a pure public-workspace shell with no root-home synthesis and no root-exclusive CLI mounts
- ensure shared terminal creation/recovery preserves collaboration-safe terminal semantics by default
- make the distinction between root-workspace and public-workspace explicit in code, comments, and workspace UI
- keep the distinction semantic, not a blanket non-shareability rule

**Non-Goals:**

- do not redesign the broader workspace-mounted system architecture
- do not remove the avatar-root workspace or its special control-plane role
- do not change terminal `cwd` resolution or workspace grant semantics beyond what is necessary to separate env ownership
- do not turn root-workspace into a forbidden or impossible collaboration target
- do not forbid carefully-scoped explicit terminal overrides when an operator intentionally wants a custom environment

## Decisions

### 1. Root-only env/CLI belongs only to `root-workspace`

`root_bash` is the only shell surface whose job is to behave like the root-workspace. It may continue to set `HOME=<rootWorkspacePath>` and expose runtime-local CLI plus avatar-private control-plane env because that surface owns root-scoped skill discovery and runtime identity.

Alternative considered: remove `HOME` rewrite everywhere, including `root_bash`.
Rejected because it would weaken the existing root-workspace contract and blur where avatar-private runtime-local files live.

### 2. `workspace_bash` remains a pure `public-workspace` shell

`workspace_bash` already behaves mostly correctly because it passes `env` through and does not synthesize `HOME`. This law becomes explicit: the mounted workspace shell is a `public-workspace` collaboration surface selected by workspace authority and `cwd`, not by root identity. It may expose public assets plus avatar-private overlays within that workspace, but it must not impersonate root-workspace home semantics or mount root-exclusive CLI helpers.

Alternative considered: rewrite `HOME` to each mounted workspace root.
Rejected because shared workspaces are collaboration domains, not per-shell home directories, and many tools treat `HOME` as user identity/state rather than current project location.

### 3. Shared terminals follow the same collaboration law as `public-workspace`

`terminal` is not a root-workspace shell. It is a shared process surface comparable to a public-workspace collaboration seat. Runtime-created and recovered terminals SHALL therefore preserve real home semantics and SHALL NOT auto-mount root-exclusive helper bins, root-only CLI, or avatar-private control-plane env by default.

Alternative considered: keep rewriting `HOME` or injecting root helper bins for terminals whose `cwd` resolves inside the avatar root workspace.
Rejected because terminal identity is defined by the shared terminal surface, not by whichever directory it starts in. A shared terminal can `cd`, `ssh`, or serve multiple workspaces over time; tying env/CLI identity to the initial cwd would keep the semantic leak.

### 4. Environment assembly must branch by surface kind, not by convenience reuse

The current bug exists because terminal creation reuses a helper that was designed for root-oriented runtime shells. The fix should not be another call-site exception. Environment assembly must model at least two distinct surface kinds:

- root-workspace environment: root-home rewrite plus root-only CLI/env allowed
- public-workspace environment: collaboration-safe shell semantics, no root-only CLI/env
- shared terminal environment: collaboration-safe terminal semantics, no root-only CLI/env

If more surface kinds appear later, they should be introduced as additional environment profiles rather than by stacking boolean overrides.

### 5. Root-private facts stop leaking onto collaborative surfaces

Anything the runtime needs for local CLI/API discovery may stay available on the root-workspace surface through dedicated env keys such as `AGENTER_ROOT_WORKSPACE`, `AGENTER_HOME_DIR`, principal identity, and loopback API credentials. But collaborative surfaces must not receive those root-private facts by default just because one runtime also owns a root-workspace.

### 6. The UI must show semantic distinction without implying an ownership wall

The workspace workbench should distinguish `root-workspace` and `public-workspace` the same way the backend does: as different env/CLI surfaces. That distinction must remain factual and visible in the page chrome, but it must not claim that root-workspace is inherently unshareable. In product terms, another avatar may still "visit" a root-workspace if some higher-level sharing/grant model allows it; what stays special is the root-workspace env/CLI profile, not an absolute no-entry policy.

## Risks / Trade-offs

- [Existing terminal helper scripts may implicitly assume root helper bins or `HOME=<rootWorkspacePath>`] → Keep root-only helpers available through `root_bash`, and update runtime guidance/tests so collaborative surfaces stop depending on root-only env/CLI.
- [Some flows may have started relying on avatar-root-local dotfiles or injected private env inside terminals] → Treat that as a bug in the shared terminal contract; if a root-like interactive shell is ever needed, it should be an explicit root-workspace mode rather than the default terminal law.
- [The term `public-workspace` can be misread as “contains only public files”] → Document in code comments and UI copy that the term describes shell/collaboration semantics, while the mounted workspace may still contain avatar-private subtrees under its workspace system roots.
- [UI distinction may accidentally imply that root-workspace can never be shared] → Use copy that explains the difference as env/CLI behavior rather than an ownership prohibition.
- [Changing terminal and workspace defaults can reveal hidden coupling in tests or scripts] → Add focused contract tests for `root_bash`, `workspace_bash`, terminal create/recovery, and workspace UI labeling.

## Migration Plan

1. Split runtime environment assembly into root-shell and shared-terminal profiles.
2. Rename and document the semantics as `root-workspace` versus `public-workspace` in the relevant runtime code paths and comments.
3. Keep `root_bash` on the root-workspace profile.
4. Keep `workspace_bash` on the public-workspace profile with no root-only CLI/env synthesis.
5. Move terminal create/recovery to the shared-terminal collaboration profile.
6. Update workspace UI contracts so the workbench distinguishes root-workspace and public-workspace without implying a hard no-sharing rule.
7. Update OpenSpec specs and runtime/UI tests to lock the new law before implementation lands.

Rollback is straightforward because this change does not migrate durable data. Reverting means restoring the old environment assembly, though that would reintroduce the incorrect terminal behavior.

## Open Questions

- Should terminal creation eventually expose an explicit root-workspace interactive shell mode for the rare cases that truly need avatar-private CLI/env, instead of relying on ad-hoc env overrides?
- How much of the current `workspace` naming in types and UI should be upgraded to the more explicit `public-workspace` term without causing unnecessary churn in low-level storage identifiers?
