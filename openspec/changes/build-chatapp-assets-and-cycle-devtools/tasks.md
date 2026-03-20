## 1. Session Assets

- [x] 1.1 Add the change artifacts for ChatApp surface, generic session assets, and cycle timeline Devtools
- [x] 1.2 Generalize app-server, session-system, and client-sdk attachment models and routes from image-only assets to generic session assets
- [x] 1.3 Update Quick Start and Chat send flows to upload pending assets at send time and preserve optimistic cycle behavior

## 2. ChatApp Surface

- [x] 2.1 Split the current Chat route into reusable ChatApp surface components for viewport, composer, attachment tray, and previews
- [x] 2.2 Extend the CodeMirror composer with slash commands, picker/drag-drop asset intake, and browser screenshot capture
- [x] 2.3 Render stored image, video, and file attachments with kind-appropriate previews while keeping Chat conversation-first

## 3. Cycles Devtools

- [x] 3.1 Replace the current cycle accordion with a live virtualized cycle timeline and selected-cycle detail surface
- [x] 3.2 Wire chat-side cycle navigation affordances to stable cycle ids without reintroducing cycle-first chat rendering

## 4. Verification

- [x] 4.1 Add unit and integration coverage for session asset lifecycle, generic attachment send flow, and screenshot capture behavior
- [x] 4.2 Add Storybook DOM coverage for the ChatApp composer, attachment previews, and cycle timeline interactions
- [x] 4.3 Run focused app-server/client-sdk/webui tests plus real browser walkthroughs for chat, attachments, and Devtools cycles until the change is ready
