## Context

The existing Workspace `CLI` page already answers “what commands exist for this workspace lens?” through one grouped catalog. The missing piece is “how do I enter the right shell surface without leaving this page?” That second question is not a UI-only concern because the system has two objectively different shell laws:

- `root-workspace`: avatar-private env + runtime CLI + durable root shell world
- `public-workspace`: collaboration-oriented one-shot shell bound to one mounted workspace grant set

The browser cannot safely infer those laws from prose alone. `message send --help` and `tool_review --help` are both command rows, but they belong to different execution surfaces. The current `workspace.exec` endpoint also only reaches `public-workspace`, so browser execution would currently misroute root-runtime rows.

## Goals / Non-Goals

**Goals**

- Let the Workspace `CLI` page launch a real shell run without leaving the current workbench.
- Keep execution truth on the backend shell primitives that already exist.
- Make execution surface selection objective instead of feature-local guesswork.
- Preserve the existing Workspace tab model while giving shell execution its own dedicated sub-route.

**Non-Goals**

- Build a browser-local shell with `@wterm/just-bash`.
- Replace terminals for long-lived work.
- Turn helpcenter into a generic command palette for every future system.
- Auto-start stopped runtimes just because the browser clicked a root-shell command.

## Decisions

### 1. Add explicit browser execution metadata to CLI catalog rows

Every browser-visible CLI row gets a `suggestedCommand`. Rows may also declare `preferredExecutionSurface` when the surface is not “whatever this current workspace shell already is.”

- root runtime CLI rows declare `preferredExecutionSurface = "root-workspace"`
- workspace tool rows declare `preferredExecutionSurface = "public-workspace"`
- builtin rows reuse the current workspace surface, so they only need `suggestedCommand`

This keeps the catalog as the single truth for browser execution affordances without inventing a fake universal role model.

### 2. Extend `workspace.exec` instead of adding a second browser-only executor

The browser already has one typed execution route. The correct move is to extend that route with `surface?: "root-workspace" | "public-workspace"` and route internally:

- `public-workspace` keeps the current `executeWorkspaceBash(...)` path
- `root-workspace` forwards to the active `SessionRuntime` durable root shell world

This keeps shell truth in one backend contract and avoids forking execution semantics between browser and runtime.

### 3. Root browser exec must require an already-active runtime

Root execution depends on one active `SessionRuntime` because the durable root shell world, runtime-local API, mounted authorities, and avatar-private env all live there. The browser must not silently auto-start a runtime just to run one helpcenter command. If the runtime is not active, the endpoint returns an explicit error and the shell dialog prints that fact.

This preserves the law that root authority is owned by the active runtime, not by the helpcenter page.

### 4. Route `Run in shell` into a dedicated workspace shell dialog

The operator is already in the right context: workspace lens, avatar lens, grouped command catalog. Opening a dedicated shell dialog from that page keeps the discovery surface and the execution surface in the same workspace tab, but avoids turning one detail drawer into a configuration form.

The shell-dialog behavior:

- opens from one selected CLI row
- auto-runs immediately on open
- projects stdout/stderr/exit code into one terminal dialog
- lets the operator keep typing later commands in the same backend shell surface without re-opening helpcenter
- keeps the browser side limited to prompt editing, history recall, and transcript projection

This keeps browser shell UX lightweight without building a browser-local shell.

## Risks / Trade-offs

- [Risk] Builtin rows do not declare an explicit surface.
  Mitigation: they intentionally inherit the current workspace surface, which is already objective route state (`avatar-root` vs mounted workspace).

- [Risk] A terminal-looking dialog could imply full PTY semantics.
  Mitigation: keep execution on `workspace.exec`, project only typed command/result flow, and avoid pretending the browser owns the shell truth.

- [Risk] Stopped runtime makes root commands fail from the browser.
  Mitigation: return a plain error that names the problem instead of implicitly starting runtime authority.

## Migration Plan

1. Add OpenSpec artifacts and durable spec deltas.
2. Extend catalog metadata and backend exec routing.
3. Add typed client runtime-store surface support.
4. Add the WebUI shell dialog wiring.
5. Add backend and WebUI verification, including inactive-runtime root non-zero shell-result coverage.

Rollback strategy:

- Revert the change as one unit if browser execution semantics drift from backend shell truth.
