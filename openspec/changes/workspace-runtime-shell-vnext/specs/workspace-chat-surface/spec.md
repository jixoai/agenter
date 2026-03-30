## REMOVED Requirements

### Requirement: Chat SHALL only show user-facing assistant output
**Reason**: workspace/session-first Chat 不再是 primary surface；conversation browsing 改由 global room-first `Chats` 承载，而 running-avatar detail shell 聚焦 runtime-specific panels。
**Migration**: 使用 global `Chats` 浏览 room 和 conversation；running-avatar detail shell 只保留 runtime-oriented panels。
