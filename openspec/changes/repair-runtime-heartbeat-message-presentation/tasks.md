## 1. Spec and guidance

- [x] 1.1 Record the Heartbeat presentation and structured-viewer override contract changes in OpenSpec.
- [x] 1.2 Record the ai-elements-svelte official LLM docs URL in durable repo guidance.

## 2. Runtime Heartbeat presentation

- [x] 2.1 Rework Heartbeat rows to use inspection-first surfaces instead of chat-primary bubble styling.
- [x] 2.2 Remove redundant `user/user`, `round 0`, and `Text` presentation noise from default Heartbeat row rendering.
- [x] 2.3 Bind Heartbeat row avatars to the active AvatarSession icon.
- [x] 2.4 Remove nested border chrome from plain text Heartbeat parts.
- [x] 2.5 Add collapsed high-signal previews for Heartbeat tool rows.
- [x] 2.6 Restore sticky-bottom + `ConversationScrollButton` behavior for the virtualized Heartbeat conversation surface.
- [x] 2.7 Align `role=user` Heartbeat rows to `inline-end` at the row level instead of only reversing internal layout.
- [x] 2.8 Preserve objective Heartbeat `message-parts` order across streaming response updates instead of rebuilding rows in a fixed type order.
- [x] 2.9 Keep running Heartbeat tool rows visible without rendering empty-string parameter chrome as meaningful payload.

## 3. Structured viewer behavior and verification

- [x] 3.1 Update structured-value viewer mode behavior so global changes immediately affect non-overridden viewers while local overrides remain DOM-local.
- [x] 3.2 Add or update regression coverage for Heartbeat row presentation and structured viewer mode behavior.
- [x] 3.3 Run typecheck/tests and verify the repaired Heartbeat UI in the browser.
- [x] 3.4 Add regression coverage for virtual conversation stick-to-bottom behavior and `role=user` row alignment.
- [x] 3.5 Add regression coverage for objective `message-parts` order and in-progress tool-call rendering.
