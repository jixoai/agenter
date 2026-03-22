## Why

The current terminal work only modernizes the model-facing surface inside `app-server`. The real terminal authority still lives in fragmented runtime glue, lacks a canonical control plane, and does not yet expose the richer process metadata, config, and transport behavior from the original target. That leaves AI-facing ergonomics inconsistent and keeps terminal-system from becoming the reusable backend service the product needs.

## What Changes

- Promote terminal-system into the canonical terminal control plane instead of leaving focus/read/write behavior embedded in app-server runtime glue.
- Extend terminal contracts beyond `focus/read/snapshot` so the runtime can create, list, kill, configure, and inspect terminal instances through one coherent API family.
- Add stable terminal metadata and shortcut configuration (`icon`, `title`, `shortcuts`) so AI and WebUI consumers share one declarative process profile model.
- Add a websocket transport contract so terminal-system can publish PTY streams directly for xterm-based renderers.

## Capabilities

### Modified Capabilities
- `terminal-control-plane`: terminal focus, read, snapshot, write, create, kill, list, and configuration become one declarative control plane rooted in terminal-system.

### New Capabilities
- `terminal-process-profiles`: process-level icon/title/shortcut metadata and default styling contracts.
- `terminal-pty-transport`: websocket PTY transport published by terminal-system for renderer consumers.

## Impact

- Affected code: `packages/terminal-system`, `packages/app-server`, prompt/runtime contract wiring, and future renderer consumers.
- Affected APIs: terminal MCP/tool surface, terminal-system runtime APIs, config schemas, and PTY transport endpoints.
- Affected tests: terminal-system integration tests, app-server terminal tool regressions, websocket transport tests.

## Delivery Order

1. Build on the focus/read adapter semantics already proven in `integrate-message-terminal-attention-sources`.
2. Promote terminal-system into the canonical owner of lifecycle, config, and transport.
3. Keep app-server as a compatibility adapter while client and renderer consumers migrate.
4. Feed the resulting contract into `propagate-terminal-contract-to-clients` and `extract-terminal-view-webcomponent`.
