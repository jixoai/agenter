## 1. OpenSpec / Contracts

- [x] 1.1 Add delta specs for chat presentation, chatapp surface, multimodal input, navigation, workspace settings, cycles timeline, and overflow contracts plus the new profile image system spec.
- [x] 1.2 Update `AGENTS.md` with the new chat-product, profile-image, and layout/background best-practice rules.

## 2. Backend profile image and global settings APIs

- [x] 2.1 Add shared server helpers for deterministic session/avatar fallback icons plus uploaded-icon resolution.
- [x] 2.2 Add session icon upload/get APIs and HTTP media routes.
- [x] 2.3 Add avatar catalog read/update plus avatar icon upload/get APIs.
- [x] 2.4 Add global user-settings read/save APIs for the dedicated global Settings route.

## 3. Client data model and controller wiring

- [x] 3.1 Extend client-sdk types/runtime store with profile image URLs and global settings/avatar catalog methods.
- [x] 3.2 Wire App controller state for global settings, avatar catalog loading, and background session icon hydration/upload.

## 4. Chat surface refactor

- [x] 4.1 Refactor transcript projection to message-first rows with restrained time/date dividers and cycle backlinks only for expert actions.
- [x] 4.2 Add bubble avatars and per-message context menus/long-press affordances without surfacing cycle terminology in the main transcript.
- [x] 4.3 Keep optimistic user rows and live assistant output visible immediately while preserving attachment previews.
- [x] 4.4 Remove image-affordance hard gating and replace it with compatibility validation/notice behavior.

## 5. Navigation, settings, and visual contracts

- [x] 5.1 Add the dedicated global Settings route and entry point while keeping primary navigation limited to Quick Start and Workspaces.
- [x] 5.2 Implement the avatar catalog/user settings UI and keep workspace settings scoped to workspace layers.
- [x] 5.3 Update sidebar/chat/session surfaces to use the new session/avatar icon URLs.
- [x] 5.4 Tighten scroll/clip/background primitives, fix typography tokens, and normalize Cycles/Devtools density and scrolling.

## 6. Verification

- [x] 6.1 Add/update unit tests for chat projection, profile image helpers, and overflow/background contracts.
- [x] 6.2 Add/update Storybook DOM tests for AIInput attachments, Chat transcript behavior, and global settings avatar management.
- [x] 6.3 Run targeted typecheck/test coverage for touched packages and do desktop + mobile browser walkthroughs for Chat, Devtools, Cycles, and Global Settings.
