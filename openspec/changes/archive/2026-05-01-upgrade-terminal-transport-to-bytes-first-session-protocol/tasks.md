## 1. Transport Protocol Rewrite

- [x] 1.1 Replace string-first live transport frames with bytes-first transport types for client and server messages.
- [x] 1.2 Decide and implement the concrete wire representation for live bytes as protobuf-encoded websocket binary frames backed by a shared schema package.
- [x] 1.3 Preserve minimal sideband control frames only for bootstrap/status/error/resize and remove live string-first `rawInput` as the protocol truth.

## 2. Terminal-System Live Session Law

- [x] 2.1 Update terminal-system websocket parsing and dispatch to accept bytes-first live input and emit bytes-first live output.
- [x] 2.2 Keep lifecycle transition, running PTY, and collaboration write-lease gates on the live bytes path.
- [x] 2.3 Keep automation `terminal.write` / pending / approval / activity semantics outside the live bytes transport truth.
- [x] 2.4 Update durable package docs in `packages/terminal-system/SPEC.md` to reflect bytes-first transport v2 before archive.

## 3. Terminal-View Primitive

- [x] 3.1 Update terminal-view to publish terminal-native live input bytes instead of string-first `rawInput` frames.
- [x] 3.2 Keep terminal-view host props limited to `transportUrl`, `terminalId`, `snapshot`, and `viewportMode`.
- [x] 3.3 Keep `resize` as a minimal sideband control frame sourced from local viewport geometry.
- [x] 3.4 Ensure browser semantic interactions prefer terminal-native byte/control-sequence encoding rather than transport-level semantic events.

## 4. Verification

- [x] 4.1 Rewrite terminal-view tests around bytes-first live transport semantics.
- [x] 4.2 Rewrite terminal-system tests around bytes-first live transport semantics, including no pending/activity facts for live session traffic.
- [x] 4.3 Keep or update real browser walkthrough coverage for typed input, arrow/control sequences, resize, and no automation write requests.
- [x] 4.4 Add shared protocol roundtrip tests for protobuf client/server frame encoding and decoding.
- [x] 4.5 Run `bun run --filter '@agenter/terminal-view' test`.
- [x] 4.6 Run `bun run --filter '@agenter/terminal-system' test`.
- [x] 4.7 Run targeted WebUI terminal browser regression for live input transport.
- [x] 4.8 Run terminal-view and terminal-system typechecks.
- [x] 4.9 Run `bun run --filter '@agenter/terminal-transport-protocol' test`.
- [x] 4.10 Run terminal-transport-protocol typecheck.
