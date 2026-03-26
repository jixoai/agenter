## Why

The current runtime still violates two important laws:

- user-selected model provider can be accidentally overridden by project settings, causing sessions to run against the wrong provider;
- unresolved attention debt can remain present while the system appears to have simply stopped cycling, without a clear distinction between `ready`, `backoff`, and `blocked` causes.

In the current repository, `~/.agenter/settings.json` selects `activeProvider = kimi`, but `resolveSessionConfig()` still resolves `default/deepseek` because project settings override the user selection. That is a direct root cause of sessions entering repeated `attention.no_progress` containment instead of progressing with the intended provider.

## What Changes

- Make `ai.activeProvider` follow user-owned precedence: local override > user selection > project default > builtin default.
- Keep provider catalogs merged across layers without letting project defaults silently replace the user's active provider choice.
- Treat non-zero attention scores as durable obligations: containment may place them in `backoff` or `blocked`, but never semantically resolves them.
- Strengthen runtime publication/tests so unresolved debt with provider/config failure is explicitly diagnosable rather than looking like silent completion.

## Capabilities

### Modified Capabilities
- `settings-provider-selection`: user-selected active provider remains authoritative unless a local override is present.
- `attention-runtime-scheduling`: non-zero scores remain explicit obligations even when containment prevents immediate re-entry.
- `runtime-ui-publication`: blocked/backoff causes stay inspectable for unresolved attention debt.

## Impact

- Affected code: `packages/settings/src/*`, `packages/app-server/src/session-config.ts`, runtime publication/tests, real/runtime verification harnesses.
- Affected UX: session creation uses the intended provider; unresolved debt surfaces as `blocked/backoff` diagnosis instead of apparent silent stop.
