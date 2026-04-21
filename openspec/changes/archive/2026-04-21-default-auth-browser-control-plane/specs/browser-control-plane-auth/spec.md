# browser-control-plane-auth Specification

## ADDED Requirements

### Requirement: Browser-facing control plane SHALL require authentication by default
All browser-facing daemon control-plane routes SHALL require an authenticated browser auth session unless the route is explicitly part of the login/bootstrap allowlist.

#### Scenario: Anonymous browser request hits a protected control-plane route
- **WHEN** a browser caller invokes a protected browser-facing route such as session, workspace, settings, runtime, filesystem, notification, task, or profile management without a valid bearer token
- **THEN** the daemon rejects the request with `UNAUTHORIZED`
- **THEN** the route does not silently behave as an anonymous local control surface

#### Scenario: Authenticated browser request reaches a protected route
- **WHEN** a browser caller invokes the same control-plane route with a valid bearer token
- **THEN** the daemon evaluates the request under the authenticated auth claims
- **THEN** later resource-level authorization may still apply on top of that browser auth session

### Requirement: Anonymous browser access SHALL be limited to auth bootstrap routes
The only anonymous browser-facing routes SHALL be the login/bootstrap surfaces needed to discover auth mode and obtain a browser auth session, including `auth.service`, `auth.challengeStart`, `auth.challengeVerify`, daemon-mediated `auth.autoLogin`, daemon-managed `auth.storeAutoLoginKey`, and optional login-related routes that are explicitly declared public.

#### Scenario: Anonymous browser can discover auth bootstrap state
- **WHEN** a fresh browser client requests the auth bootstrap descriptor
- **THEN** the daemon returns the auth descriptor without requiring a bearer token
- **THEN** the browser can decide whether to try stored-token verification, auto login, or explicit manual login

#### Scenario: Anonymous browser cannot reuse non-bootstrap routes as discovery paths
- **WHEN** a fresh browser client attempts to list workspaces, read settings, or inspect runtime state before login
- **THEN** the daemon rejects those calls with `UNAUTHORIZED`
- **THEN** the browser must continue through the auth bootstrap flow instead of discovering protected state anonymously

### Requirement: Superadmin authority SHALL own the machine-local browser control plane
Machine-local browser control-plane routes that mutate or inspect local sessions, workspaces, settings, runtime state, filesystem state, notifications, avatars, and profiles SHALL require a superadmin browser auth session.

#### Scenario: Authenticated non-superadmin caller is denied machine control-plane access
- **WHEN** a browser caller presents a valid bearer token whose claims are authenticated but not superadmin
- **THEN** machine-local browser control-plane routes reject the request with `FORBIDDEN`
- **THEN** authenticated status alone does not grant machine control authority

#### Scenario: Superadmin caller can reach the machine control plane
- **WHEN** a browser caller presents a valid bearer token whose claims include `superadmin`
- **THEN** the daemon allows access to the machine-local browser control-plane routes
- **THEN** the routes continue to enforce their normal input and resource validation semantics

### Requirement: Daemon SHALL support managed automatic superadmin login
The daemon SHALL support automatic browser login by loading a machine-local root auth private key from `~/.agenter/local.env`, optionally bootstrapping that key locally when supported, signing the auth challenge inside the daemon, and returning only the resulting auth session to the browser.

#### Scenario: Auto login succeeds from machine-local key storage
- **WHEN** the daemon has a usable root auth private key in `~/.agenter/local.env`
- **THEN** `auth.autoLogin` returns a valid browser auth session without revealing the raw private key
- **THEN** the browser can enter the authenticated shell without prompting for manual key entry

#### Scenario: Managed local bootstrap can persist the auto-login key
- **WHEN** the daemon is backed by a managed-local auth authority and the operator invokes `auth.storeAutoLoginKey`
- **THEN** the daemon resolves the root auth private key internally and stores it in `~/.agenter/local.env`
- **THEN** future `auth.autoLogin` attempts can succeed without browser-visible key reveal

#### Scenario: Auto login falls back cleanly when unavailable
- **WHEN** the daemon cannot load or bootstrap a machine-local root auth private key
- **THEN** `auth.autoLogin` returns an explicit unavailable result instead of fabricating a partial session
- **THEN** the browser falls back to explicit manual onboarding/login

### Requirement: Browser-facing origin policy SHALL reject arbitrary loopback callers
The daemon SHALL only emit browser CORS authorization for same-origin requests and explicit loopback development origins needed by the supported WebUI delivery modes.

#### Scenario: Same-origin or supported loopback dev origin is accepted
- **WHEN** the browser origin matches the daemon host or an allowed local development loopback origin
- **THEN** the daemon returns the corresponding `Access-Control-Allow-Origin` value
- **THEN** browser auth bootstrap and authenticated requests may proceed under the normal auth law

#### Scenario: Arbitrary browser origin is rejected
- **WHEN** a webpage from an unrelated origin invokes the browser-facing daemon
- **THEN** the daemon withholds CORS authorization for that origin
- **THEN** the browser cannot use that origin as an anonymous machine-control trampoline

### Requirement: Browser-facing media transport SHALL require browser auth
Browser-facing session and room asset upload/download routes SHALL require authenticated browser authority. Upload routes SHALL accept bearer auth headers, and retrievable media routes SHALL accept bearer headers or an equivalent browser-safe auth token projection for media-tag URL usage.

#### Scenario: Anonymous media upload is rejected
- **WHEN** a browser caller posts session or room assets without authenticated browser authority
- **THEN** the daemon rejects the upload with an authorization failure
- **THEN** no asset record is created

#### Scenario: Authenticated media URL remains renderable
- **WHEN** an authenticated browser resolves a session or room asset URL for use in an image, video, or link surface
- **THEN** the daemon accepts bearer auth or the derived browser-safe media auth projection for that asset request
- **THEN** the stored asset remains retrievable without reopening anonymous access
