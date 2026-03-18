## 1. Server and persistence contracts

- [x] 1.1 Add draft capability resolution for a workspace/avatar pair so Quick Start can know whether image input is supported before a session exists
- [x] 1.2 Add session-scoped image upload and media retrieval routes with `image/*` validation
- [x] 1.3 Extend `@agenter/session-system` with image asset records and message-to-asset linkage
- [x] 1.4 Update app-server chat send/list flows to accept attachment identifiers and return persisted attachment metadata
- [x] 1.5 Tighten the terminal snapshot contract so `tail` is emitted as a single string

## 2. Model and client runtime integration

- [x] 2.1 Upgrade model-facing user message shaping from text-only input to multimodal input for providers that support images
- [x] 2.2 Expose provider capability metadata through runtime/client contracts for active sessions and draft session resolution
- [x] 2.3 Extend client-sdk state and APIs to carry chat attachments, upload metadata, and workspace path completion results
- [x] 2.4 Keep unsupported providers image-free by hiding attachment affordances instead of downgrading images to plain text

## 3. Shared WebUI building blocks

- [x] 3.1 Implement the shared CodeMirror-based `AIInput` with Enter/Shift+Enter behavior, pending image thumbnails, preview dialog, and failure recovery
- [x] 3.2 Implement workspace-scoped `@` path completion in `AIInput` so accepted completions replace the token with a relative path
- [x] 3.3 Extract reusable `WorkspaceItem` and `SessionItem` components with shared single-select and double-activate behavior for desktop and mobile
- [x] 3.4 Add deterministic dynamic session navigation items with workspace-derived avatars and identifying tooltips

## 4. View composition and rendering

- [x] 4.1 Promote Quick Start into its own primary view with workspace controls, `AIInput`, and the latest three recent sessions
- [x] 4.2 Refactor Chat and Workspaces to use the shared master-detail shell plus the new item components and dynamic session shortcuts
- [x] 4.3 Update Chat rendering to show persisted image attachments and use the CodeMirror Markdown renderer only for text-oriented blocks
- [x] 4.4 Update Model and other Devtools surfaces to keep structured payloads in structured views instead of long Markdown dumps

## 5. Validation

- [x] 5.1 Add BDD tests for Quick Start routing, dynamic session navigation, and shared item interaction behavior
- [x] 5.2 Add BDD/integration coverage for AIInput submit semantics, `@` completion, image preview, and failed-send recovery
- [x] 5.3 Add server/client integration tests for image upload, chat attachment persistence, capability gating, and session lifecycle cleanup
- [x] 5.4 Run the relevant package test suites plus OpenSpec validation for the new change artifacts
