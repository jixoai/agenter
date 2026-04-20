## 1. Contract Reset

- [x] 1.1 Replace the public room-message `rootId` contract with same-room `ref` across message-system types, storage, query, and transport projections
- [x] 1.2 Remove automatic attention-to-message room output paths, including `message_reply` egress and the summary-driven message hook bridge
- [x] 1.3 Update runtime descriptor/help/skill contracts so `message send`, `message read`, `message edit`, and `message recall` teach the explicit post-send revision workflow

## 2. Test-First Coverage

- [x] 2.1 Add BDD tests for ref-only room writes, ref-aware `message read`, and rejection of non-room/internal anchors
- [x] 2.2 Add runtime tests proving attention commits no longer create visible room messages without explicit message mutations
- [x] 2.3 Add transcript tests for first-class reply previews and objective edited/recalled reference state
- [x] 2.4 Add or update regression coverage for duplicate-send revision guidance and real message revision flows

## 3. Runtime and UI Implementation

- [x] 3.1 Implement the ref-only message contract and ref-aware runtime message read/send projections
- [x] 3.2 Remove attention egress / message hook plumbing and keep room-visible output on explicit message actions only
- [x] 3.3 Implement shared transcript reference previews and wire them through the message workbench host surfaces

## 4. Verification

- [x] 4.1 Run targeted app-server, message-system, and web-chat-view tests for the new contracts
- [x] 4.2 Update generated runtime skill/catalog outputs and verify the new help text matches the implemented descriptor schemas
