## 1. Message Query Contract

- [x] 1.1 Add message query request/result types and public exports in `packages/message-system`
- [x] 1.2 Add query parser/compiler helpers for `match`, `query`, and read-only `sql` modes

## 2. Message Index

- [x] 2.1 Add the SQLite sidecar `message-query.sqlite` schema and initialization logic
- [x] 2.2 Add projection upsert/rebuild/dirty-state reconciliation from room durable truth

## 3. Message-System Integration

- [x] 3.1 Add authorized room-scope resolution for one room, many rooms, and `chatId: "*"`
- [x] 3.2 Add `message query` execution APIs on `MessageControlPlane` with auth-before-search enforcement

## 4. App-Server Integration

- [x] 4.1 Add authenticated app-kernel wrappers for message query using auth actor scope
- [x] 4.2 Expose `message.query` through tRPC and client SDK types

## 5. Verification

- [x] 5.1 Add BDD tests for index sync, authorized room scoping, query modes, and SQL guardrails
- [x] 5.2 Update durable specs/tasks state and run targeted verification for the completed change

## 6. Runtime Shell And AI Verification

- [x] 6.1 Expose `message query` through the descriptor-backed runtime shell/local API so AI can call it via `root_workspace_bash`
- [x] 6.2 Add runtime CLI, AgenterAI, and mock-loopbus integration tests that exercise authorized room search through the actual AI tool surface
