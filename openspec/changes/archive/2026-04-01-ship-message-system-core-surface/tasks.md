## 1. Spec And Data Adapters

- [x] 1.1 Author the message-system proposal, design, and capability spec.
- [x] 1.2 Build Svelte data adapters/selectors for global rooms, room snapshots, room grants, auth actors, and profile projections.
- [x] 1.3 Add shared identity presentation helpers so room users always render auth/profile-backed avatars and names.

## 2. Message-System Surface

- [x] 2.1 Implement the `/messages` route shell with room list, transcript pane, users/access pane, and send composer.
- [x] 2.2 Implement room lifecycle actions: create, edit metadata, archive, delete, and source-unavailable presentation.
- [x] 2.3 Implement the send-as composer with actor selection and message-send wiring through the runtime store.

## 3. Read State, Access, And Verification

- [x] 3.1 Implement room access dialogs and user list behaviors using auth-backed actors and room grants.
- [x] 3.2 Render read progress and participant read timestamps instead of pending-attention badges.
- [x] 3.3 Add Storybook/Playwright coverage for room creation, grant mutation, send-as, and read-state rendering.
