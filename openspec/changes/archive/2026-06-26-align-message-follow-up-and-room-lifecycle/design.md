## Context

The repo is between two laws:

1. old law: `followUpAfterMs` behaves like a session-local generic watch
2. new law: `followUpAfterMs` is local room durability owned by `message-system`

The user has already rejected the old direction. The remaining work is therefore not "make both coexist forever", but:

- finish removing old session-runtime ownership residue
- explicitly defer the remote path until the correct transport law exists
- connect room lifecycle to companion `AttentionContext` lifecycle instead of leaving archive as a disconnected manual-only status

## Decisions

### Decision 1: Local follow-up ownership belongs to message-system room durability

For local room sends, `followUpAfterMs` means:

- write the visible durable room message
- in the same room transaction, write one durable follow-up task keyed to that message
- on message-system runtime startup, reload tasks and arm timers
- on due time, re-check latest-visible eligibility, emit follow-up attention ingress, then remove the task

`app-server` runtime no longer owns a second scheduler for this path.

### Decision 2: Managed-seat remote follow-up is explicitly deferred

Today's managed-seat bridge only forwards concrete room mutations such as `globalSend`. It does not preserve runtime-local execution context, session-local scheduler ownership, or cross-process attention routing identity.

Therefore this change does **not** add another optional `followUpAfterMs` field to the current RPC bridge. The future-correct solution is:

- AsyncContext carries follow-up ownership/context across the local call graph
- RPC propagation preserves that context across authority boundaries
- the remote side can then materialize the same durable task law without inventing bridge-local scheduler semantics

Until that architecture exists, remote follow-up stays unsupported by design.

### Decision 3: Room and AttentionContext are companion lifecycles

Room history belongs to `message-system`. `AttentionContext` owns attention focus lifecycle. These are separate truths, but for room-backed work they are companions.

When a room-backed companion context is explicitly driven to `muted`:

- the context stays durable
- room history stays durable
- the room projects to `archived`

This is archive, not delete:

- sends are still allowed unless some other rule blocks them
- history remains queryable
- the change is primarily a visibility / navigation projection

### Decision 4: Active and archived rooms must be separate surfaces

Once archive is lifecycle-driven, the UI must stop treating every room as part of one flat active list.

Required surface direction:

- default room catalogs show `active-room-list`
- archived rooms move behind an explicit `archived-room-list` entrypoint
- runtime/message inspection surfaces stop presenting legacy generic watch wording as if it were the source of truth for message follow-up

## Non-Goals

- Do not solve remote follow-up by adding bridge-local transport fields now.
- Do not delete or dissolve rooms as part of companion mute/archive behavior.
- Do not restrict room send/read authority just because a room is archived.

## Risks

- Leaving remote follow-up unsupported can look incomplete if not documented clearly.
  - Mitigation: keep code comments and delta specs explicit that this is an intentional architecture deferral.
- Archive lifecycle touches backend truth and multiple frontend lists.
  - Mitigation: land the lifecycle law first, then migrate room catalogs/inspection surfaces in focused follow-up tasks.
