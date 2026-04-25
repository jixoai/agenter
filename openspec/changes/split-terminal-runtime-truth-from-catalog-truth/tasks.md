## 1. OpenSpec Truth

- [x] 1.1 Add delta specs for terminal control-plane, runtime terminal contract, PTY transport, terminal surface projection, and terminal-system surface so the new lifecycle and observed-identity law is explicitly testable.
- [x] 1.2 Sync proposal/design acceptance criteria with the new stop/bootstrap/delete, no-auto-start, and observed title/path model.

## 2. Terminal Kernel Refactor

- [x] 2.1 Extend terminal-system types and durable DB schema to represent launch truth, process lifecycle, and observed identity separately.
- [x] 2.2 Add observed title/path capture in terminal core using xterm title events plus OSC parsing fallback.
- [x] 2.3 Replace mixed `kill` behavior with explicit `stop`, `bootstrap`, and `delete` control-plane operations.
- [x] 2.4 Remove implicit auto-start from transport open, automation write/input, and inspection paths.
- [x] 2.5 Make PTY exit persistence record stop reason, exit code/signal, and stopped timestamp, and only expose `transportUrl` while running.

## 3. Runtime / Client Projection

- [x] 3.1 Publish lifecycle and observed identity through app-server terminal projections and realtime invalidation.
- [x] 3.2 Update TRPC and client-sdk types/merge logic so transport removal, lifecycle transitions, and observed identity updates are preserved instead of merged away.
- [ ] 3.3 Expose runtime terminal lifecycle through descriptor-backed CLI commands with explicit `bootstrap` and `stop` verbs plus lifecycle-aware list projections.
- [ ] 3.4 Sync built-in terminal skill and lifecycle references so shell guidance teaches status inspection, bootstrap, and stop using the new lifecycle law.

## 4. WebUI Surface

- [x] 4.1 Add a shared terminal display helper that resolves title, subtitle, status chips, and action labels from the authoritative projection.
- [x] 4.2 Update terminal page-toolbar, window surface, tabs, users dialog, and action panel to consume lifecycle/observed truth and stop using fixed catalog cwd/title fallbacks.
- [x] 4.3 Keep stopped terminals on-route with disabled write/read surfaces and explicit bootstrap affordances; delete remains the only destructive navigation-away action.

## 5. Verification

- [x] 5.1 Add layered BDD coverage for terminal-system, app-server, client-sdk, and WebUI around stop/bootstrap/delete, no-auto-start, observed title/path, and transportUrl clearing.
- [x] 5.2 Run OpenSpec validation for the new change.
- [x] 5.3 Run targeted package test suites for `@agenter/terminal-system`, `@agenter/app-server`, `@agenter/client-sdk`, and `@agenter/webui`.
- [x] 5.4 Run a real browser walkthrough on desktop and `iPhone 14`, plus a real AI terminal walkthrough, and record the self-review/changelog under `.chat/`.
- [ ] 5.5 Add targeted runtime CLI / built-in skill regression coverage for explicit `terminal bootstrap`, `terminal stop`, lifecycle-aware `terminal list`, and the split instance-name vs PTY-title display law.
