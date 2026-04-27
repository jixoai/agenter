## Context

TerminalSystem already owns the terminal physical truth through Bun PTY, `@xterm/headless`, stable snapshots, status transitions, and commit wait handles. Runtime-local `terminal read` exposes immediate observation only, while Avatar traces show repeated `sleep && terminal read | grep` loops to approximate a bounded wait-for-evidence operation.

The missing law is not another passive AttentionSystem wake-up. Attention answers "is there new work"; the Avatar also needs an active tool-call yield that blocks until terminal state changes or stabilizes, then returns enough evidence to continue reasoning without a second read.

## Goals / Non-Goals

**Goals:**

- Add `terminal await` as a descriptor-backed runtime-local command separate from `terminal read`.
- Model `await` as a bounded observation over stable headless terminal snapshots.
- Return structured outcome and evidence for matched, absent, idle, changed, timeout, stopped, and cancellable cases.
- Include bounded clean snapshot lines/tail and match context in the result.
- Ensure every long-running wait path observes abort/cancellation signals and releases terminal waiters/listeners.
- Keep the primitive deterministic and domain-agnostic.

**Non-Goals:**

- Do not add AI-assisted matching to TerminalSystem core.
- Do not add Claude-specific prompt recipes to TerminalSystem core.
- Do not expose raw PTY stream matching as the default `await` behavior.
- Do not change `terminal read` semantics.
- Do not add natural flag parsing to descriptor-backed runtime CLI commands.

## Decisions

### 1. `terminal await` is a new bounded observation primitive, not an overloaded read mode

`terminal read` remains the immediate inspection primitive. `terminal await` owns the blocking/yield semantics:

- wait for change, idle, match, or absence
- enforce a bounded timeout
- return post-mortem evidence
- clean up resources on cancellation

This keeps `read` simple and avoids a single command carrying both immediate and long-running semantics.

### 2. The match target is a stable clean snapshot, not raw PTY bytes

Terminal TUIs overwrite cells, move cursors, and clear regions. Matching raw byte streams would preserve the false append-only-log model that caused the current `grep` loops. `terminal await` therefore waits for a stable snapshot from the existing headless terminal state, then applies deterministic matching to clean plain-text lines.

Raw streaming can still exist later as a Unix adapter such as `terminal follow --format=jsonl`, but it is not the first AI-facing primitive.

### 3. The command is descriptor-backed JSON, not ad hoc shell flags

Runtime-local CLI law already says descriptor-backed commands accept JSON stdin, one JSON argv payload, or explicit compact encoding. `terminal await` follows that law. The public schema should expose fields such as:

- `terminalId`
- `wait.until`
- `wait.timeoutMs`
- `wait.idleMs`
- `match.pattern`
- `match.regex`
- `match.caseInsensitive`
- `match.contextLines`
- `view.type`
- `view.lines`
- `recordActivity`

Any future ergonomic shell flags must compile to the same descriptor payload rather than bypassing it.

### 4. Snapshot lines are evidence and must be bounded

`terminal await` should return enough clean lines for the Avatar to continue reasoning. It should not return unbounded scrollback by default.

The first phase should support:

- bounded tail lines by default
- explicit `view.lines` cap
- match context lines independent from the broader tail
- metadata for `seq`, terminal status, running state, rows, and columns

Full scrollback and raw ANSI bytes are out of scope for this primitive.

### 5. Timeout is an outcome, not a shell-level failure

The command-level timeout returns a structured result with the last observed snapshot/evidence. This avoids the Unix `timeout` hazard where the caller loses the failure scene.

However, callers may still wrap the command in shell-level `timeout`. Therefore the implementation must treat process signals and request aborts as first-class cancellation facts. If transport is still available, it may return `outcome = cancelled`; if the shell kills the process before a response can be delivered, the server-side waiters and listeners still must be released.

### 6. Wait semantics must use event handles, not hidden sleep loops

`write/input.returnRead` currently approximates delayed observation through fixed delay before read. `terminal await` should instead use existing terminal event primitives:

- `waitCommitted(fromHash)` for changed output
- status/snapshot listeners for idle and stopped state
- timeout race with explicit cancellation of all losers

Polling may remain an internal fallback only if no event source can represent the condition, and it must still share the same abort signal.

### 7. Deterministic core first; plugins later

Core `terminal await` must not know Claude prompts, permission text, or business-level completion rules. A later `terminal claude <command>` plugin may provide recipes built on top of `terminal await`, but that plugin layer must not pollute the TerminalSystem physical-fact contract.

## Risks / Trade-offs

- Regex can be expensive or brittle → limit match input with bounded lines, require explicit `regex`, and keep deterministic evidence in the result.
- AI may still use Unix `timeout` → trap CLI/process signals where possible, propagate abort to the runtime request, and require server-side cleanup even when no response reaches the caller.
- Await can become a hidden scheduler → keep it scoped to one terminal observation and require explicit timeout bounds.
- Snapshot evidence may be too small → expose `view.lines` while enforcing a safe maximum.
- Match/absent semantics can be ambiguous → define first-phase `absent` as "condition holds on the stable snapshot"; reserve "seen then gone" for a later explicit `gone` condition.

## Migration Plan

No migration is required for existing commands. `terminal read` remains unchanged. Avatar guidance and help text should introduce `terminal await` as the preferred replacement for `sleep && terminal read | grep` when the task needs bounded terminal observation.

## Open Questions

- What exact maximum should cap `view.lines` in the first implementation?
- Should `terminal await` default `recordActivity` to true like `terminal read`, or default to false to avoid recording repeated waiting probes?
