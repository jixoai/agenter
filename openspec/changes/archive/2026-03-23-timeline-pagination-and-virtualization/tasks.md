## 1. Session history contract

- [x] 1.1 Add `session-history-pagination` delta specs and shared reverse-time cursor/page types.
- [x] 1.2 Refactor session-db and app-server history queries to use explicit reverse-time pages for chat messages, cycles, LoopBus traces/state logs, model calls, and API calls.
- [x] 1.3 Persist LoopBus state logs and add a paged terminal-activity query keyed by `sessionId + terminalId`.

## 2. Client/runtime integration

- [x] 2.1 Replace runtime-store `beforeId` paging state with shared reverse-time page state helpers.
- [x] 2.2 Hydrate only recent history windows and prepend older pages without duplicates or order regressions.
- [x] 2.3 Expose controller-level loading state for chat, cycles, LoopBus, terminal activity, and model/API history through one consistent shape.

## 3. WebUI long-list surfaces

- [x] 3.1 Make Chat always use a reverse virtualized viewport with prepend-anchor preservation.
- [x] 3.2 Update Cycles, LoopBus, Terminal Activity, and Model history/HTTP surfaces to use server-backed reverse paging and virtualization.
- [x] 3.3 Add regression coverage for page ordering, four-state loading behavior, and long-list prepend stability.
