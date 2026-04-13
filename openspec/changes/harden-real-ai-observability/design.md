## Context

The architecture already established three durable laws, but the implementation only satisfies them partially:

1. Persona law: `AGENTER.mdx` is the place for Avatar personality and thinking style, yet only the external-fact scenario currently uses a dedicated test Avatar prompt. Relay, room-terminal, and project-room validations still drift with the shared default Avatar state.
2. Observability law: the new `session.db` ledger is the durable truth, but the current debug flow is ad hoc. Engineers still end up waiting for a timeout before they can inspect model-call segments, room truth, or the copied database.
3. Runtime-shell law: `Heartbeat`, `Attention`, and `Settings` already exist as canonical tabs, but first-load hydration still depends too much on optimistic client state. When runtime or persisted facts are not loaded yet, the shell can look empty even though the backend has durable truth ready.

## Decision

Treat real-AI diagnostics and runtime-shell hydration as first-class platform rules rather than per-scenario glue:

- Add a shared real-AI observability layer in the backend test-support/scripts area.
  - Single-avatar harnesses keep accepting `avatarNickname` and `agenterPromptContent`.
  - Team harnesses grow the same ability per participant, so backend and frontend test Avatars can each mount their own `AGENTER.mdx`.
  - Scenarios stop using the shared default Avatar when their behavior depends on prompt law.
- Add a monitored runner utility that wraps a real scenario and continuously emits objective progress facts:
  - elapsed time
  - `message_part` counts by scope
  - current `ai_call` statuses
  - latest room-truth message
  - latest tool-trace tool names
- Snapshot durable evidence on both success and failure.
  - Copy `session.db` only after the scenario has reached a settled observable checkpoint for that runner.
  - Print the snapshot path together with session id, session root, and segmented timings so engineers can inspect facts immediately.
- Tighten runtime-shell hydration.
  - Runtime routes explicitly hydrate persisted chat history and attention/notification data on entry instead of assuming prior websocket state.
  - `Heartbeat` stays ledger-backed.
  - `Attention` must render current or persisted attention truth, plus explicit empty states.
  - `Settings` must expose runtime prompt-source content and source identity so prompt law is inspectable without leaving the shell.

## Consequences

- Real-AI tests gain more maintained prompt fixtures, but those fixtures stay orthogonal and scenario-scoped instead of leaking into the shared default Avatar.
- Debug runners become an official observability surface, which reduces guesswork and makes long-running provider regressions stoppable mid-flight.
- Runtime-shell entry becomes slightly more eager about data hydration, but that is the correct platform tradeoff because the shell is supposed to be the durable inspection surface for runtime facts.

## Verification

- Targeted backend tests for persona fixture wiring, monitored snapshot export, and runtime-shell hydration helpers.
- Monitored real-provider runs for relay, room-terminal, realistic-user, and project-room scenarios with live session-db analysis.
- WebUI verification through targeted tests plus browser walkthrough on desktop and mobile.
