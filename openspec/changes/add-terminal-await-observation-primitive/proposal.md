## Why

The default Avatar repeatedly reconstructs terminal observation with shell glue such as `sleep && terminal read | grep` because the AI-facing terminal CLI has immediate reads but no bounded, evidence-returning way to yield until terminal state stabilizes. This is a platform gap: TerminalSystem already owns headless snapshot truth, status, and commit wait handles, but the runtime does not expose a deterministic observation primitive that preserves the AI's active chain-of-thought flow.

## What Changes

- Add descriptor-backed `terminal await` as a bounded terminal observation primitive separate from `terminal read`.
- Define `terminal await` as a deterministic wait over stable terminal snapshots, not a raw PTY byte stream matcher.
- Support first-phase conditions for changed output, idle stabilization, match, absent, and timeout outcomes.
- Return structured post-mortem evidence for every outcome, including timeout and stopped cases.
- Include bounded clean snapshot lines/tail and match context so the AI does not need an immediate follow-up `terminal read`.
- Require long-running await operations to observe cancellation/abort signals and release all waiters/listeners when the caller, shell, or runtime terminates the command.
- Keep AI-assisted matching, Claude-specific recipes, and Unix streaming adapters out of the core primitive for this change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `terminal-control-plane`: add a cancellation-safe terminal await operation over terminal physical snapshot/status facts.
- `runtime-terminal-contract`: expose terminal await through the runtime-local terminal contract with structured evidence and bounded snapshot lines.
- `runtime-json-tool-descriptor-surface`: add descriptor-backed `terminal await` CLI/API/help schema without changing `terminal read`.
- `runtime-skills-cli-surface`: teach Avatar-facing terminal guidance to prefer `terminal await` over `sleep && terminal read | grep` for bounded terminal observation.

## Impact

- `openspec/specs/terminal-control-plane/spec.md`
- `openspec/specs/runtime-terminal-contract/spec.md`
- `openspec/specs/runtime-json-tool-descriptor-surface/spec.md`
- `openspec/specs/runtime-skills-cli-surface/spec.md`
- `packages/terminal-system/src/*`
- `packages/app-server/src/runtime-tool-descriptors.ts`
- `packages/app-server/src/session-runtime.ts`
- `packages/terminal-system/skills/terminal/*`
- targeted BDD coverage for cancellation cleanup, timeout evidence, descriptor help, and Avatar guidance
