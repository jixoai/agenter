# Self Review: add-terminal-await-observation-primitive

Date: 2026-04-28

## Scope

Change `add-terminal-await-observation-primitive` adds `terminal await` as a descriptor-backed, cancellation-safe terminal observation primitive. This review records objective checks before archive.

## Rounds

1. Platform boundary: `terminal await` is a new command and does not overload `terminal read`.
2. Orthogonality: TerminalSystem core contains no Claude/Codex/iflow-specific matching rules.
3. Truth ownership: await reads TerminalSystem snapshot/status/commit facts instead of duplicating terminal state in SessionRuntime.
4. Snapshot model: match and absent conditions operate on clean snapshot lines, not PTY byte streams.
5. Evidence bound: returned `snapshot.lines` is capped by `view.lines` with a hard maximum.
6. Timeout semantics: command-level timeout returns structured post-mortem evidence instead of failing without a scene.
7. Cancellation cleanup: await cleanup clears idle/timeout timers, rejects commit waiters, removes snapshot/status listeners, and detaches abort listeners.
8. Shell timeout risk: runtime CLI forwards command context abort into `fetch`, and runtime-local API forwards request/response abort into descriptor handlers.
9. Activity law: await records observation activity by default and supports `recordActivity:false` for pure probes.
10. Descriptor law: route, schema, help, examples, and CLI behavior come from the shared descriptor registry.
11. Skill guidance: built-in terminal skill teaches await for bounded wait-for-evidence and keeps read framed as immediate inspection.
12. Durable spec sync: root and package SPEC now include the await/cancellation law before archive.

## Residual Notes

- First phase intentionally omits AI-assisted matching, Claude plugin recipes, and raw JSONL streaming.
- Await activity currently reuses `terminal_read` event kind with `title = "Terminal await"` to avoid widening the durable event enum in this change.
