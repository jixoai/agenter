## Why

Room and terminal lifecycle changes do not have one clear attention policy today. Some lifecycle commits exist but stay invisible because they default to `score=0`, while some terminal paths do not emit lifecycle commits at all.

## What Changes

- Define one lifecycle-attention policy for room and terminal structure changes.
- Promote room `create/update/archive` and terminal `create/delete/config_update` into active attention items.
- Keep focus/unfocus lifecycle facts queryable but non-blocking.
- Fill terminal lifecycle gaps for `focus remove/clear/replace`, `terminal_set_config`, and related runtime paths.

## Capabilities

### Modified
- `attention-runtime-kernel`
- `session-runtime-attention-message`
- `terminal-control-plane`

## Impact

- Affected packages: `app-server`, `attention-system`, `i18n-*`.
- Verification: targeted session-runtime attention tests, app-server regression tests, and typecheck.
