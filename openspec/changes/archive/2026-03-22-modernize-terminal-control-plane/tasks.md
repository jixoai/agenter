## 1. Control-plane contracts

- [x] 1.1 Add OpenSpec proposal, design, and capability specs for terminal-system-owned control-plane expansion
- [x] 1.2 Define terminal lifecycle APIs for `terminal_list`, `terminal_create`, `terminal_kill`, `terminal_focus`, `terminal_read`, `terminal_snapshot`, and `terminal_write`
- [x] 1.3 Define process-profile config contracts for `icon`, `title`, `shortcuts`, and default process styling

## 2. Transport and configuration

- [x] 2.1 Add terminal config APIs for reading and updating default/per-process terminal profiles
- [x] 2.2 Add websocket PTY transport contracts and endpoint discovery rules
- [x] 2.3 Add integration tests for transport startup, endpoint discovery, and process lifecycle operations

## 3. App-server adaptation

- [x] 3.1 Update app-server terminal adapters to consume the terminal-system control plane instead of runtime-local glue
- [x] 3.2 Remove remaining legacy terminal inspection aliases and copy that conflict with the new control-plane contract
- [x] 3.3 Add regression tests for the app-server-facing terminal tool surface after the terminal-system migration

## Execution Notes

- Terminal-system becomes the source of truth in this change; app-server remains an adapter until later consumers finish migrating.
- Keep terminal tool naming aligned with the control-plane family here so client/webui changes can stay mechanical in later changes.
- Do not extract the renderer package here; only publish the transport it will need.
