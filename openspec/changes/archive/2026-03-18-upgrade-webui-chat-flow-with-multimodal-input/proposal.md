## Why

The current WebUI still mixes entry flows, chat flows, and workspace/session management in a way that feels like a pile of features instead of a coherent application. The input experience is also too limited for an AI IDE workflow because it still depends on textarea-style editing, has no durable attachment pipeline, and cannot reliably express path completion or image context.

This change is needed now because the agreed product direction is already clear: Quick Start must become a first-class entry, Chat must behave like a professional session-based workspace, and multimodal input must work end-to-end instead of being simulated in the UI.

## What Changes

- Promote `Quick Start` into a dedicated WebUI entry with its own AI input, workspace controls, and recent session shortcuts.
- Replace the current textarea-based chat composer with a shared CodeMirror-based `AIInput` component for Quick Start and Chat.
- Add image attachments as a complete session-scoped feature: select/paste/drag, preview, upload, persist, render in chat, and submit to providers that support image input.
- Add workspace-relative `@` path completion that resolves to plain relative paths before submission.
- Reorganize WebUI navigation into stable primary views plus dynamic session shortcuts, and standardize reusable `WorkspaceItem` / `SessionItem` interactions.
- Expose provider draft capabilities so the UI can decide whether image input is available before a session starts.
- **BREAKING** Collapse terminal snapshot `tail` payloads from `string[]` to a single `string` so the runtime and UI share one compact contract.

## Capabilities

### New Capabilities
- `webui-chat-navigation`: Application-level navigation for Quick Start, Chat, Workspaces, dynamic session shortcuts, and reusable workspace/session entry behavior.
- `multimodal-ai-input`: A shared CodeMirror-based AI input that supports submit semantics, workspace path completion, and provider-gated image attachments.
- `session-image-assets`: Session-scoped image upload, storage, serving, attachment persistence, and chat rendering.

### Modified Capabilities
- None.

## Impact

- Affected packages: `@agenter/webui`, `@agenter/client-sdk`, `@agenter/app-server`, `@agenter/session-system`, and `@agenter/cli`.
- New HTTP media/upload routes are required alongside existing tRPC procedures.
- Model-facing message types must evolve from text-only input to multimodal user input.
- WebUI composition will shift from `App.tsx`-centric state to shared view/input/item components.
- Tests must be extended across UI behavior, upload flow, capability gating, and runtime persistence.
