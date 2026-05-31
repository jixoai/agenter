## Context

The browser-facing daemon currently treats much of the local control plane as anonymous by default. Session, workspace, settings, runtime, filesystem, notification, and avatar/profile mutation routes can be reached without first establishing a browser auth session. WebUI also hydrates protected data before auth is complete, and direct HTTP asset endpoints bypass the bearer-auth contract entirely.

This conflicts with the intended platform law:

- browser-facing control plane is authenticated by default
- only login bootstrap routes stay public
- global superadmin is allowed to override machine-local control-plane authority
- room and terminal grants remain resource-scoped proofs inside an already authenticated browser session

There is a second architectural problem: the current onboarding flow reveals the managed root private key to the browser. That makes the browser a carrier of long-lived machine authority instead of a consumer of short-lived auth sessions.

## Goals / Non-Goals

**Goals:**
- Make browser-facing tRPC and direct HTTP control-plane routes require auth by default.
- Split browser access into three layers: anonymous login bootstrap, authenticated resource collaboration, and superadmin-only machine control plane.
- Add daemon-mediated automatic superadmin login using `~/.agenter/local.env` without exposing raw private key to the browser.
- Gate WebUI so login/bootstrap completes before the main workbench shell hydrates protected data.
- Require browser auth for session/room asset upload and retrieval while preserving room/terminal resource proofs.
- Remove browser-facing raw managed-root-key reveal from the normal contract.

**Non-Goals:**
- Do not change runtime-local principal-key auth for avatar-local APIs in this change.
- Do not redesign room or terminal resource-grant semantics beyond adding the outer browser-auth gate.
- Do not rewrite all media rendering surfaces to `fetch -> blob URL`; a transport-compatible transition is sufficient.
- Do not broaden auth modes beyond the existing challenge-based flow and optional legacy email routes.

## Decisions

### 1. Browser-facing auth is modeled as a fixed three-layer law

The daemon browser surface is split into:

1. public bootstrap routes used only to discover auth mode and mint/verify a login session
2. authenticated collaboration routes that still require room/terminal scoped credentials where applicable
3. superadmin-only machine control-plane routes for local sessions, workspaces, settings, filesystem, runtime inspection, and profile/avatar administration

Why:
- This removes the current ad-hoc mixture of anonymous and authenticated routes.
- It preserves orthogonality: browser auth proves who the operator is, while room/terminal grants prove what that operator may do inside a specific resource.

Alternative rejected:
- Patching individual anonymous routes without changing the default would keep the control plane in a permanently fragile state.

### 2. The daemon owns root-key bootstrap and automatic login

The daemon reads `AGENTER_ROOT_AUTH_PRIVATE_KEY` from `~/.agenter/local.env`. If the value is absent and the local child auth authority supports managed root-key reveal, the daemon may bootstrap that value internally and persist it into `local.env`. Browser-facing auto login is then implemented as a daemon-side challenge-sign-verify flow that returns only the auth session projection to the browser.

Why:
- It keeps long-lived machine authority on the machine side.
- It enables automatic login without teaching the browser about root private keys.

Alternatives rejected:
- Revealing the managed key to the browser keeps the wrong authority boundary.
- Storing the raw private key in browser storage would be a direct regression.

### 3. Router authorization is expressed through procedure aliases, not route-local folklore

`appRouter` will use explicit procedure aliases:

- `publicProcedure`
- `authProcedure`
- `superadminProcedure`

Most browser control-plane routers move to `superadminProcedure`. Global room and terminal routes stay on `authProcedure`, with the existing resource-grant checks continuing inside kernel methods.

Why:
- The router becomes declarative and mechanically auditable.
- It removes hidden inconsistencies created by mixing `t.procedure`, `requireAuth`, and `requireSuperadmin` directly.

Alternative rejected:
- Continuing to sprinkle middleware case by case would preserve accidental public access.

### 4. Direct HTTP asset transport is tightened without rewriting the UI surface

Browser-facing asset upload endpoints require `Authorization: Bearer ...`. Browser-facing asset download endpoints accept either bearer auth headers or a derived query-token fallback so existing `<img>/<video>/<a>` URL consumers remain functional during this migration. Client SDK owns the query-token derivation for app-server-hosted media URLs.

Why:
- Browser media tags cannot reliably attach custom headers.
- This keeps the existing rendering contract alive while removing anonymous asset access.

Alternative rejected:
- A full fetch/blob rewrite across all attachment surfaces is larger than this change and not required to restore the control-plane law.

### 5. WebUI boot is promoted into an explicit auth-bootstrap state machine

The app controller no longer infers auth readiness from `authSession === null`. It performs:

1. runtime connect
2. verify stored bearer token
3. attempt daemon auto login
4. fall back to explicit onboarding/login UI
5. hydrate protected workbench data only after authenticated success

Why:
- It separates “connecting”, “probing auth”, “authenticated”, and “needs login”.
- It prevents the current half-authenticated startup path where protected data loads before auth is settled.

Alternative rejected:
- Keeping bootstrap implicit inside `refreshBootstrap()` preserves race conditions and stale-shell bugs.

### 6. Browser origin policy becomes explicit instead of wildcard CORS

The daemon accepts same-origin requests and explicit loopback dev origins, and rejects unrelated browser origins instead of sending `Access-Control-Allow-Origin: *`.

Why:
- Loopback delivery is still a browser surface and should not accept arbitrary local webpages by default.
- `agenter web --dev` still needs cross-port local development support.

Alternative rejected:
- Wildcard CORS on a machine-control daemon is incompatible with the new default-auth law.

## Risks / Trade-offs

- [Room/session media query-token fallback is less pure than header-only auth] → Keep the fallback narrowly scoped to app-server media URLs and treat it as a migration bridge.
- [Auto-login depends on machine-local key file health] → Keep explicit onboarding available and report bootstrap failure clearly when the daemon cannot load or store the local key.
- [More routes become `UNAUTHORIZED` or `FORBIDDEN`] → Update client-sdk, WebUI, and tests in the same change so the new contract lands atomically.
- [Non-superadmin auth sessions may exist later] → Preserve the separate `authProcedure` layer now so future non-superadmin operators do not force another router rewrite.

## Migration Plan

1. Add the new durable specs and route-classification law.
2. Refactor app-server router to use public/auth/superadmin procedure aliases and add daemon auto-login endpoints.
3. Tighten CLI direct HTTP endpoints and CORS/origin handling.
4. Update client-sdk auth/bootstrap/media transport helpers.
5. Refactor WebUI startup gating and remove raw-key reveal from browser-facing flows.
6. Add regression tests for anonymous denial, superadmin access, auto login, media transport, and WebUI bootstrap states.

## Open Questions

- None for this slice. The remaining open work is implementation and verification, not app semantics.
