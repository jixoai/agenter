## Why

The current attention tooling leaks internal attention replies into the Chat surface and still uses weak heuristics to deduplicate optimistic user messages. That violates the product contract that Chat is a user-facing surface, not a dump of internal attention-system activity.

## What Changes

- Replace `attention_reply` with an internal attention update contract that does not produce user-visible chat output.
- Change `attention_query` so `minScore` defaults to `1`, excluding inactive items unless explicitly requested.
- Make Chat projection deduplicate optimistic and persisted messages by identity instead of timestamp guessing.
- Keep attention-system facts visible in Devtools, not in the primary Chat transcript.

## Capabilities

### Modified Capabilities
- `workspace-chat-surface`: Chat only renders user messages and assistant replies intended for users.
- `attention-source-plugins`: attention updates stay internal to the attention pipeline unless explicitly emitted as user-facing output.

### New Capabilities
- `attention-query-threshold`: attention queries support a first-class minimum score filter with a non-zero default.

## Impact

- Affected code: `packages/attention-system`, `packages/app-server`, `packages/client-sdk`, `packages/webui`.
- Affected APIs: attention tool schemas, attention query input, runtime streaming behavior, and chat projection selectors.
- Affected tests: attention engine tests, app-server tool tests, and Chat projection regression tests.
