## Why

The current runtime teaches AI to discover shell contracts through `<command> --help`, but there is still no shared, structured command catalog for one workspace lens. `just-bash` builtins, root-workspace runtime CLI, and workspace file-backed tools are discoverable through different mechanisms, which makes the WebUI unable to show one objective “what can this workspace do right now?” page.

## What Changes

- Add a shared `helpcenter` command catalog that projects root-workspace runtime CLI commands, workspace file-backed tool commands, and `just-bash` builtins into one structured truth source.
- Add a browser-facing workspace CLI catalog query so WebUI can render the current workspace/avatar command surface without reconstructing shell truth in feature code.
- Add a new `CLI` mode inside the Workspace workbench beside `Explorer`, `Rules`, and `Private`.
- Let workspace file-backed tools optionally register `name + description` through a sidecar manifest, while still surfacing legacy callable tools with an explicit fallback description so the catalog does not hide usable commands.
- Keep arbitrary PATH binaries out of the app command catalog, while explicitly including `just-bash` builtins because they are part of the real shell contract.

## Capabilities

### New Capabilities
- `workspace-cli-helpcenter`: Shared command catalog and shell/browser helpcenter surface for builtins, runtime CLI commands, and workspace tool commands.

### Modified Capabilities
- `workspace-system-capabilities`: Workspace shell surfaces gain an explicit command discovery contract instead of relying on bare `help`.
- `workspace-system-workbench`: Workspace detail gains a `CLI` mode that renders the same command catalog truth as the shell.
- `client-runtime-store`: The client runtime facade gains typed workspace CLI catalog queries instead of route-local transport calls.

## Impact

- `packages/app-server`: shared command catalog model, workspace tool metadata scanning, helpcenter shell command, and browser query surface.
- `packages/client-sdk`: typed CLI catalog contracts and runtime-store wrappers.
- `packages/webui`: workspace `CLI` mode UI, search/group rendering, and compact/desktop coverage.
- Durable docs/specs: `SPEC.md`, affected package specs, and the new OpenSpec capability specs.
