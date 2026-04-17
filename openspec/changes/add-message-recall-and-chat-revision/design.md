## Context

The current room-message platform already has the right outer shape:

- durable room truth is stored in `message-system`
- transport upserts already key transcript items by `messageId`
- `message edit` has started landing in backend code paths
- `web-chat-view` already merges snapshot and incremental updates by `messageId`

What is still missing is the full message-revision law:

- there is no `message recall` primitive
- there is no durable recalled-state contract in `MessageRecord`
- real-provider validation does not yet prove natural `send -> edit` or `send -> recall -> send` behavior
- the shared transcript cannot yet render recalled truth as a first-class room fact

This gap creates the exact failure the user called out: the AI falls back to sending a second corrective room reply because the platform cannot express "withdraw or revise the prior message" as a durable, objective lifecycle update.

## Goals / Non-Goals

**Goals:**

- Model `send`, `edit`, and `recall` as orthogonal room-message mutations.
- Preserve one stable `messageId` across in-place edits and recalls.
- Make recalled messages visible as recalled facts while preventing stale original content from remaining the primary user-visible transcript body.
- Publish edits and recalls through the same room snapshot/page/incremental transport contract used for any other durable room message.
- Render message revision state in the shared chat UI without route-local reconstruction logic.
- Prove the new law with real-provider validation that does not explicitly name the commands in the user prompt.

**Non-Goals:**

- Implement full message version history or multi-revision diff browsing.
- Hard-delete recalled messages from durable storage.
- Rewrite the existing room auto-ack policy in this same change.
- Add a generalized operator message-management UI beyond objective transcript rendering.

## Decisions

### Model recall as a peer mutation, not as a `send` special case

`message recall` will be introduced as its own input type, authorization path, runtime tool, and transport message. It will sit alongside `message send` and `message edit`.

This keeps the correction primitives orthogonal:

- `send` creates a new durable room fact
- `edit` corrects the content of an existing durable room fact
- `recall` withdraws the user-visible body of an existing durable room fact while keeping the room fact itself durable

Alternative considered:

- Add a `mode: "recall"` branch inside `message send`.
  - Rejected because it would turn the create primitive into a special-case mutation multiplexer and would hide lifecycle semantics from the platform contract.

### Persist recall as durable lifecycle metadata on the same message row

Recalled truth will remain attached to the original `messageId`. The durable room record will expose explicit recall metadata, and the shared transcript will render recalled state from that metadata. The recall mutation will also clear the user-visible body that the room snapshot transports, so stale content is not accidentally re-presented as the current message truth.

The resulting law is:

- edited message: same `messageId`, newer `updatedAt`, current content remains visible
- recalled message: same `messageId`, explicit recall metadata, visible body replaced by recalled-state rendering

Alternative considered:

- Keep original content intact and only set a hidden `recalled` flag.
  - Rejected because stale room content would still leak through generic readers unless every consumer remembered to mask it.

### Keep edit and recall sender-authorized by default

The default durable rule remains that only the original sender can edit or recall their own room message, unless an existing trusted bootstrap/superadmin path already grants broader authority.

This preserves message ownership and avoids turning correction primitives into arbitrary room-moderation tools by accident.

Alternative considered:

- Allow any room admin to edit or recall any message through the default room token.
  - Rejected because that would silently broaden the meaning of ordinary room membership/admin grants and can be added later as an explicit moderation contract if needed.

### Treat transcript rendering as an objective projection, not a synthetic follow-up message

`web-chat-view` will continue to merge room entries by `messageId`. Edited and recalled lifecycle updates will therefore update the existing transcript row in place. The transcript will derive visual state directly from the durable record:

- `updatedAt > createdAt` and not recalled => edited
- explicit recall metadata => recalled

The UI will not generate a second "message corrected" or "message recalled" transcript row.

Alternative considered:

- Project edits/recalls as extra route-local system messages.
  - Rejected because it would distort the durable room timeline and would make one message appear as multiple facts.

### Add real-provider validation as a separate capability

The existing real-provider collaboration validations are about broader room workflows. This change needs a narrower validator that proves the assistant can discover and use the correction primitives naturally. That validator will:

- create a fresh room/avatar context
- issue a task that encourages an early draft before verification
- verify whether the assistant uses `edit` or `recall` without naming those commands explicitly
- store objective transcript evidence in `.chat`

Alternative considered:

- Fold the scenarios into an existing broad room-collaboration validator.
  - Rejected because message-revision behavior would be harder to isolate and regressions would be harder to diagnose.

## Risks / Trade-offs

- [Risk] Clearing recalled message content may complicate future audit/history needs. -> Mitigation: keep explicit recall metadata and stable `messageId`; if full audit history is required later, add a dedicated revision ledger instead of leaking stale content through the live room contract.
- [Risk] Existing consumers may assume `updatedAt > createdAt` always means visible edited text. -> Mitigation: add explicit recalled metadata and update shared transcript rendering before declaring the contract complete.
- [Risk] Real-provider tests may still prefer double-send because room auto-ack remains available. -> Mitigation: use targeted scenarios that require draft correction and inspect objective room evidence rather than relying on a single transcript outcome.
- [Risk] Dirty worktree overlap can hide whether `edit` changes were already partially implemented. -> Mitigation: keep this change scoped to the message-revision path and verify the final diff file by file before reporting completion.

## Migration Plan

1. Finalize the OpenSpec delta for message revision and validation.
2. Extend `message-system` types, storage, transport, and authorization with recall metadata and recall mutation paths.
3. Thread recall through app-server runtime tools, TRPC, client-sdk, and message skill guidance.
4. Update `web-chat-view` and the room route to render edited/recalled truth from the shared record.
5. Add unit/integration coverage for send/edit/recall behavior.
6. Run real-provider validation for the `edit` and `recall` scenarios and store objective evidence under `.chat`.

Rollback strategy:

- The change is additive at the API level. If transcript rendering regresses, the UI can temporarily ignore the new recalled presentation while the durable message contract remains intact.
- If recall persistence regresses badly, the runtime tool exposure can be disabled while keeping the already-existing `edit` improvements.

## Open Questions

- Whether a future moderation flow needs admin-authored recall of another participant's message as a separate contract.
- Whether the shared transcript should expose a local affordance label such as `edited` / `recalled` inline, in metadata, or both. This change only requires objective rendering, not a final design-system wording pass.
