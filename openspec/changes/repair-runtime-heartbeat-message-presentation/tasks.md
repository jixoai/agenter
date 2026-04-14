## 1. Spec and guidance

- [ ] 1.1 Record the Heartbeat presentation and structured-viewer override contract changes in OpenSpec.
- [ ] 1.2 Record the ai-elements-svelte official LLM docs URL in durable repo guidance.

## 2. Runtime Heartbeat presentation

- [ ] 2.1 Rework Heartbeat rows to use inspection-first surfaces instead of chat-primary bubble styling.
- [ ] 2.2 Remove redundant `user/user`, `round 0`, and `Text` presentation noise from default Heartbeat row rendering.
- [ ] 2.3 Bind Heartbeat row avatars to the active AvatarSession icon.

## 3. Structured viewer behavior and verification

- [ ] 3.1 Update structured-value viewer mode behavior so global changes immediately affect non-overridden viewers while local overrides remain DOM-local.
- [ ] 3.2 Add or update regression coverage for Heartbeat row presentation and structured viewer mode behavior.
- [ ] 3.3 Run typecheck/tests and verify the repaired Heartbeat UI in the browser.
