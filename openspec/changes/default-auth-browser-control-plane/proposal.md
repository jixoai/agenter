## Why

The browser-facing daemon currently exposes too much control-plane surface without authentication, including routes that mutate sessions, workspaces, settings, and machine-local state. This conflicts with the intended law that browser access is authenticated by default, with superadmin able to override resource-local authority when needed.

## What Changes

- **BREAKING** Require authentication by default for browser-facing tRPC and direct HTTP control-plane routes.
- Add a browser-facing auth gate that distinguishes three layers: anonymous login bootstrap, authenticated resource collaboration, and superadmin-only machine control plane.
- Add daemon-mediated automatic superadmin login that uses a machine-local root auth private key from `~/.agenter/local.env` instead of revealing the raw private key to the browser.
- Remove browser access to raw managed root-key reveal and restructure onboarding around challenge-based sign-in plus daemon-side key bootstrap.
- Require bearer auth for browser-facing session and room asset upload/download endpoints, while preserving room/terminal seat tokens as resource-level proofs inside authenticated routes.
- Tighten browser-facing CORS/origin policy so arbitrary local webpages cannot invoke loopback auth or control-plane endpoints.
- Gate WebUI entry so the operator authenticates before the main workbench shell hydrates protected data.

## Capabilities

### New Capabilities
- `browser-control-plane-auth`: Defines the browser-facing default-auth law, daemon-mediated auto-login, superadmin-only machine control plane, and origin/CORS restrictions for loopback delivery.

### Modified Capabilities
- `superadmin-onboarding`: Replace browser raw-key reveal flow with daemon-side key bootstrap and automatic challenge-based login.
- `svelte-webui-platform`: Require authentication before entering the main workbench shell, with login/bootstrap as the true browser entry flow.
- `workspace-settings`: Remove anonymous workspace-settings access and require authenticated superadmin authority for browser settings control-plane access.
- `chat-channel-access-control`: Keep room-grant authority resource-scoped, but require authenticated browser control-plane access before room-global routes may use room credentials.
- `terminal-collaboration-access-control`: Keep terminal grants actor-scoped, but require authenticated browser control-plane access before global terminal routes may use seat authority.
- `room-media-assets`: Require authenticated browser authority for room asset transport while preserving room-scoped proof for the owning resource.
- `session-image-assets`: Require authenticated browser authority for session asset transport instead of anonymous session-media access.

## Impact

- Affected code: `packages/app-server`, `packages/cli`, `packages/client-sdk`, `packages/webui`.
- Public API impact: browser-facing auth routes, route guards, media transport headers, and new auto-login control-plane contract.
- Storage impact: add machine-local daemon bootstrap config in `~/.agenter/local.env`.
- Security impact: closes anonymous browser control-plane access, removes raw private key delivery to the browser, and narrows loopback cross-origin exposure.
