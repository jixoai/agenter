## 1. Spec and durable guidance

- [x] 1.1 Add OpenSpec deltas for compact positional encoding, explicit `--compact`, and independent skill guidance.

## 2. Descriptor codec and CLI parsing

- [ ] 2.1 Add a schema-derived compact codec module for descriptor-backed runtime CLI commands.
- [ ] 2.2 Teach runtime CLI parsing to accept explicit `--compact` and decode compact arrays back into standard descriptor payloads.
- [ ] 2.3 Extend descriptor help rendering with compact availability, index mapping, enum ordinals, and recursive examples.

## 3. Skills, prompts, and verification

- [ ] 3.1 Update built-in runtime skills and prompts to teach `--compact` independently per system.
- [ ] 3.2 Add or update CLI and root-bash regression coverage for compact argv/stdin, enum/union/record rules, and help output.
- [ ] 3.3 Regenerate built-in skill catalog and run targeted tests/typecheck.
