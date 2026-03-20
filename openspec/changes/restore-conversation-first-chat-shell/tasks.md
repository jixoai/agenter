## 1. Change Setup

- [x] 1.1 Add the OpenSpec proposal, design, and delta specs for the conversation-first chat shell restoration
- [x] 1.2 Audit the current chat, shell, notification, and runtime publication code paths against the new deltas before editing implementation

## 2. Runtime And Data Flow

- [x] 2.1 Add stable `cycleId` linkage to runtime chat message projections across app-server, client-sdk, and tests
- [x] 2.2 Rework Chat route projections to render from messages plus streaming state instead of cycle sections
- [x] 2.3 Tighten notification consumption and mock harness reply behavior so unread counts reflect real unread assistant replies without amplification
- [x] 2.4 Narrow runtime-store publications and selector usage so unrelated shell surfaces stay stable during hot session updates

## 3. Shell And Surface UX

- [x] 3.1 Remove cycle rails and cycle headers from the Chat surface and add message-level advanced actions that open Devtools on the related cycle
- [x] 3.2 Rebalance workspace shell chrome so the app header stays global, the workspace strip stays compact, and Chat owns its session toolbar and notices
- [x] 3.3 Rework compact Quick Start and workspace routes so the composer and primary actions stay in the first mobile viewport and bottom navigation no longer inherits broken padding/overflow behavior

## 4. Verification

- [x] 4.1 Update unit and integration coverage for message-first chat projection, runtime publication stability, and unread consumption
- [x] 4.2 Update Storybook DOM coverage for Chat, Quick Start, shell chrome, and advanced message actions
- [x] 4.3 Run focused app-server/client-sdk/webui tests plus Playwright desktop/mobile walkthroughs and capture evidence for the restored shell behavior
