## Why

The current Chat route is improved compared with the old cycle-first UI, but it still is not a mature application-grade chat surface: attachments are image-only, composer shortcuts are limited, and cycle inspection still feels like a raw internal accordion instead of a live Devtools surface. We need a reusable ChatApp component system that can handle richer attachments and a stronger Cycles experience without regressing the conversation-first contract.

## What Changes

- Build a reusable ChatApp surface toolkit for the workspace Chat route, including message viewport, composer, attachment tray, previews, and shortcut affordances.
- Generalize session attachments from image-only uploads to session-owned image/video/file assets with send-time upload flow.
- Extend the CodeMirror-based composer with `/` commands, `@` path completion, drag/drop, picker-based attachments, and screenshot capture via the browser Screen Capture API.
- Rework the Cycles/Devtools experience into a live cycle timeline with clearer state visualization and real-time updates.
- Keep Chat conversation-first while moving richer cycle inspection into the dedicated Devtools/Cycles surface.
- **BREAKING**: session asset upload and media routes move from image-only endpoints and types to generic asset endpoints and attachment types.

## Capabilities

### New Capabilities
- `chatapp-surface`: defines the reusable application-grade chat surface, composer, previews, and attachment affordances
- `cycles-devtools-timeline`: defines the live cycle-oriented Devtools timeline and detail surface

### Modified Capabilities
- `multimodal-ai-input`: extend the shared CodeMirror composer with slash commands, screenshot capture, and generic attachment affordances
- `session-image-assets`: generalize session-owned image uploads into generic session asset attachments for image, video, and file
- `chat-surface-presentation`: keep Chat conversation-first while adopting the richer ChatApp surface and attachment behavior
- `workspace-devtools-surface`: Devtools owns the upgraded cycle timeline and cycle detail inspection
- `chat-cycles`: cycle projection and chat scrolling remain cycle-backed while the UI gains explicit cycle navigation affordances

## Impact

- Affected code spans `packages/app-server`, `packages/client-sdk`, `packages/session-system`, and `packages/webui`.
- Public client/server types and HTTP media routes change around session assets.
- Storybook DOM, unit/integration tests, and real browser walkthroughs need to cover attachment handling, screenshot capture, and cycle timeline behavior.
