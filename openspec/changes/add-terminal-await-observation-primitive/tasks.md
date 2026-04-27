## 1. OpenSpec Truth

- [ ] 1.1 Validate delta specs for terminal control-plane, runtime terminal contract, runtime JSON descriptor surface, and runtime skills.
- [ ] 1.2 Before archiving, sync the durable terminal await law into the relevant long-lived `SPEC.md` files.

## 2. Terminal Control Plane

- [ ] 2.1 Add strongly typed terminal await request/result types covering wait, match, bounded view, activity, and outcome metadata.
- [ ] 2.2 Implement cancellation-safe await orchestration using terminal snapshot/status events and `waitCommitted` rather than hidden sleep loops.
- [ ] 2.3 Evaluate deterministic match and absent conditions against stable clean snapshot lines.
- [ ] 2.4 Return bounded snapshot lines/tail, match context, cursor metadata, running/status truth, and timeout/stopped evidence.
- [ ] 2.5 Ensure every await race path cancels losing timers, waiters, listeners, and fallback poll handles.
- [ ] 2.6 Record terminal await activity by default and support disabling activity recording for pure probes.

## 3. Runtime CLI / API

- [ ] 3.1 Add descriptor-backed `terminal await` schema, route, examples, compact mapping, and generated help text.
- [ ] 3.2 Wire runtime-local `terminal await` handlers through `SessionRuntime` to the terminal control plane.
- [ ] 3.3 Propagate CLI process termination and runtime request abort signals into the in-flight await operation.
- [ ] 3.4 Keep `terminal read` descriptor and behavior unchanged.

## 4. Skill Guidance

- [ ] 4.1 Update built-in terminal skill guidance to teach `terminal await` for bounded wait-for-evidence flows.
- [ ] 4.2 Teach that await returns clean bounded snapshot lines, not raw ANSI bytes.
- [ ] 4.3 Teach command-level timeout as the preferred post-mortem path while acknowledging shell-level timeout cancellation.

## 5. Verification

- [ ] 5.1 Add BDD coverage for matched, absent, changed, idle, timeout, and stopped await outcomes.
- [ ] 5.2 Add BDD coverage proving cancellation releases waiters/listeners/timers when an await is aborted.
- [ ] 5.3 Add descriptor/help tests proving `terminal await --help` exposes the JSON schema and `terminal read` remains unchanged.
- [ ] 5.4 Add runtime handler tests proving timeout returns post-mortem lines and activity recording is caller controlled.
- [ ] 5.5 Add skill guidance tests proving the terminal skill teaches `terminal await` instead of `sleep && terminal read | grep`.
- [ ] 5.6 Run targeted terminal-system/app-server tests plus OpenSpec validation.
