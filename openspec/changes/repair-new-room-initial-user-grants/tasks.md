## 1. Control Plane

- [x] 1.1 Add OpenSpec deltas for initial room user grants/focus and the NewRoom user picker contract
- [x] 1.2 Extend message-system, app-server, and client-sdk room-create payloads so one create call can materialize initial users with role and focus
- [x] 1.3 Tighten session-runtime room subscriptions so unselected avatars cannot consume room attention or wake on another actor's focus changes
- [x] 1.4 Replace default global room id allocation with an opaque generated id while preserving explicit `chatId` overrides

## 2. NewRoom Surface

- [x] 2.1 Rebuild the NewRoom user picker with item rows, avatars, user wording, and inline role selection
- [x] 2.2 Submit selected initial users through the upgraded room-create flow and keep navigation focused on the new room
- [x] 2.3 Verify the create route navigates strictly by the returned opaque room id and does not regress tab activation

## 3. Verification

- [x] 3.1 Update targeted tests for create-room payload/materialization behavior
- [x] 3.2 Run focused verification for the room-create flow and record proof on the emergent-thinking board
- [x] 3.3 Add regression coverage proving an unselected avatar cannot receive the room grant, focus, or queued attention
