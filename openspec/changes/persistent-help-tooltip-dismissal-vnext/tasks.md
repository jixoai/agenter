## 1. Help hint primitive

- [ ] 1.1 Add `HelpHint` UI primitive with default-open onboarding behavior and explicit dismissal interaction.
- [ ] 1.2 Add IndexedDB-backed dismissal store with deterministic key generation (`sha256(textContext)` + optional `helpId`).
- [ ] 1.3 Add unit coverage for key stability and persistence readback.

## 2. Surface adoption

- [ ] 2.1 Replace selected persistent helper copy in shared dialog/title surfaces with `HelpHint`.
- [ ] 2.2 Replace composer status helper surface with `HelpHint` content.
- [ ] 2.3 Migrate selected technical panel helper one-liners (Systems/Attention/Terminal Activity and related inspector headers) to `HelpHint`.

## 3. Verification

- [ ] 3.1 Update Storybook DOM scenarios for composer status/toolbar help behavior.
- [ ] 3.2 Run `bun run --filter '@agenter/webui' test:unit`.
- [ ] 3.3 Run `bun run --filter '@agenter/webui' test:dom`.
