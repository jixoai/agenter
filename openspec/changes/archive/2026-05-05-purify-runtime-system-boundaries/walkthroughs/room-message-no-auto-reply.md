## Scenario

- 10.1 Given another actor sends a question, the runtime records room facts without auto-replying
- 10.2 Given root workspace tool work starts from a room-backed task, no fallback acknowledgement appears before explicit `message send`
- 10.3 Given a relay-room send happens first, only explicit relay/origin messages appear in transcripts

## Commands

- `bun test packages/app-server/test/session-runtime.attention-system.test.ts --test-name-pattern "punctuation-heavy direct-room ingress|root workspace bash starts tool work before any visible room reply|message send targets a relay room first|root workspace bash sends a room reply itself"`

## Expected

- Question marks or direct-room topology do not create platform reply obligations.
- Root/tool work alone does not mutate the room transcript.
- Relay flow mutates only explicitly targeted rooms.
- No origin auto-ACK or hidden fallback message is produced.

## Actual

- The direct-room ingress test keeps only raw message facts and does not emit reply-obligation labels.
- The root-workspace tool-work test leaves the origin room unchanged until an explicit room mutation occurs.
- The relay-room test creates only the explicit relay-room message first.
- The explicit-origin-send test confirms runtime does not prepend an extra acknowledgement.

## Evidence

- Test file: [session-runtime.attention-system.test.ts](/Users/kzf/Dev/GitHub/jixoai-labs/agenter/packages/app-server/test/session-runtime.attention-system.test.ts:1850)
- Additional relay / no-auto-ack cases:
  - [session-runtime.attention-system.test.ts](/Users/kzf/Dev/GitHub/jixoai-labs/agenter/packages/app-server/test/session-runtime.attention-system.test.ts:4818)
  - [session-runtime.attention-system.test.ts](/Users/kzf/Dev/GitHub/jixoai-labs/agenter/packages/app-server/test/session-runtime.attention-system.test.ts:4861)
  - [session-runtime.attention-system.test.ts](/Users/kzf/Dev/GitHub/jixoai-labs/agenter/packages/app-server/test/session-runtime.attention-system.test.ts:4895)

## Verdict

- pass
- Room-visible mutation now requires explicit message actions; question marks, relay starts, and tool work no longer create hidden replies.
