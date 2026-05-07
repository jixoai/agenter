## Why

The Workspace `CLI` mode can now describe one grouped command catalog, but it still stops at “read the hint and leave.” That makes the page a static projection instead of a usable shell handoff: the operator has to manually decide which shell surface is valid, copy the command somewhere else, and hope the browser path matches the backend shell truth.

That gap is already objectively visible in the current implementation. Browser catalog rows include root runtime CLI commands such as `message send` and `workspace list`, but `workspace.exec` only runs the public-workspace one-shot shell today. If WebUI adds a naive “Run in shell” button without backend changes, some catalog rows will open a shell on the wrong authority surface and fail for avoidable reasons.

## What Changes

- Extend the shared workspace CLI catalog with browser execution metadata:
  - `suggestedCommand`
  - optional `preferredExecutionSurface`
- Extend browser workspace execution so `workspace.exec` can explicitly route to `root-workspace` or `public-workspace` truth instead of assuming only one shell law.
- Add one dedicated Workspace shell dialog inside the current workspace tab.
- Auto-run the selected command when the shell dialog opens, then keep the same backend shell surface ready for the next typed command.
- Keep the backend shell as the only execution truth. The browser shell dialog becomes a terminal projection over existing shell primitives, not a second shell implementation.

## Capabilities

### New Capabilities

- `workspace-shell-dialog`: Execute catalog-backed workspace CLI commands from the Workspace helpcenter through one dedicated shell dialog backed by real shell truth.

### Modified Capabilities

- `workspace-cli-helpcenter`: command rows now include browser execution metadata instead of only static description text.
- `workspace-system-capabilities`: browser workspace exec now distinguishes `root-workspace` from `public-workspace`.
- `workspace-system-workbench`: Workspace `CLI` mode gains one shell-dialog handoff that can launch one selected command immediately.
- `client-runtime-store`: typed workspace exec now accepts an explicit execution surface.

## Impact

- `packages/app-server`: catalog metadata, root/public execution routing, and runtime-active validation.
- `packages/client-sdk`: typed execution surface transport.
- `packages/webui`: shell dialog projection and compact/desktop coverage.
- Durable docs/specs: `SPEC.md`, `packages/app-server/SPEC.md`, and affected capability specs.
