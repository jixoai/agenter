# client-runtime-store Specification

## Purpose

Define the durable client-side runtime normalization, long-history paging contract, and Welcome access-state derivation across workspaces, running avatars, and global resources.

## Requirements

### Requirement: Client runtime store SHALL normalize the terminal contract without losing set semantics

The client runtime store SHALL normalize workspaces, running avatars, workspace avatar catalogs, global rooms, global terminals, and attachment bindings as first-class resource maps. It SHALL NOT collapse those resources back into session-owned `*BySession` stores as the primary identity axis, and it SHALL continue to preserve terminal focus-set semantics. For global terminals, the normalized projection SHALL preserve render-critical facts such as absolute cwd, renderer metadata, durable snapshot hydration state, and live transport URL across refresh and incremental updates.

#### Scenario: Store receives global resources plus running avatars

- **WHEN** the runtime store ingests snapshots containing workspaces, running avatars, workspace avatar catalogs, global rooms, global terminals, and attachment metadata
- **THEN** it preserves workspace ids, avatar/session ids, room ids, terminal ids, and workspace avatar catalogs as distinct primary identities
- **THEN** selectors can derive workspace and running-avatar views without copying those resources into session-owned authority maps

#### Scenario: Avatar catalog subscription updates one workspace

- **WHEN** the store receives an avatar catalog invalidation event for one workspace path
- **THEN** it updates only that workspace avatar catalog entry map
- **THEN** unrelated workspace catalogs remain unchanged

#### Scenario: Global terminal render facts survive refresh

- **WHEN** the browser refreshes while a global terminal is selected
- **THEN** the normalized terminal entry still carries its absolute cwd, latest durable snapshot, and transport URL after hydration
- **THEN** route consumers do not need a second ad hoc refetch to render the terminal again

### Requirement: Client runtime store SHALL track reverse-time paging state per long-history resource

The client runtime store SHALL maintain explicit reverse-time page state for each long-history global resource and each long-history running-avatar detail resource, and SHALL hydrate only recent windows by default.

#### Scenario: Paging workspace history is independent from room history

- **WHEN** the client prepends an older page for workspace history
- **THEN** the workspace-history cursor advances for that workspace target only
- **THEN** room or terminal history cursors remain unchanged

#### Scenario: Running-avatar detail paging stays runtime-scoped

- **WHEN** the client loads older cycle or model-call history for a running-avatar detail shell
- **THEN** the resource window for that running avatar expands according to its own cursor
- **THEN** unrelated workspace history, room history, or terminal history windows are not mutated

#### Scenario: Persisted history replaces equivalent runtime chat rows

- **WHEN** `runtime.snapshot` already contains in-memory chat rows and `chat.list` later hydrates the same messages with persisted ids
- **THEN** the client runtime store collapses those semantic duplicates into one row per message
- **THEN** the persisted record wins over the in-memory runtime copy

#### Scenario: Deep grouped Heartbeat hydration settles explicitly

- **WHEN** grouped Heartbeat hydration runs for a session with deep persisted history
- **THEN** the cached grouped resource settles to loaded-with-data, loaded-empty, or error explicitly once the grouped page request settles
- **AND** the store does not leave Heartbeat in a permanent loading state just because the grouped query path is expensive

#### Scenario: Grouped Heartbeat refresh keeps warm data while the next page settles

- **WHEN** a realtime invalidation or route refresh triggers a new grouped Heartbeat fetch for a session that already has visible groups
- **THEN** the store preserves the existing grouped rows during the refresh
- **AND** it marks the resource as refreshing until the new request settles
- **AND** a failed refresh surfaces an explicit error instead of dropping back to cold loading

#### Scenario: Heartbeat shell hydration avoids unrelated heavy history

- **WHEN** the runtime shell hydrates a Heartbeat route for one session
- **THEN** the client runtime store skips transcript history and unrelated devtools timelines during that cold start
- **AND** it only hydrates the Heartbeat-owned grouped resource, the minimal model-call window, and the route-owned notification/channel facts

### Requirement: Client runtime store SHALL keep bounded windows for long-list resources

The client runtime store SHALL maintain bounded in-memory windows for workspace history, room timelines, terminal activity, and running-avatar detail resources, and SHALL keep pagination state separate from the visible list projection.

#### Scenario: Recent windows stay hydrated without loading full history

- **WHEN** a route hydrates a workspace history list, room timeline, terminal activity list, or running-avatar detail history
- **THEN** the store keeps only the configured recent window in memory by default
- **THEN** older history remains available through explicit pagination state instead of eager full hydration

#### Scenario: Heartbeat route skips unrelated heavy histories

- **WHEN** the client hydrates a running-avatar Heartbeat route
- **THEN** the runtime store only requests the histories that Heartbeat actually renders
- **THEN** transcript history and devtools-only timelines stay on-demand instead of piggybacking on the Heartbeat cold start

#### Scenario: Loading older pages does not duplicate the visible window

- **WHEN** the store prepends older pages for a workspace, room, terminal, or running-avatar detail resource
- **THEN** existing rows are not duplicated
- **THEN** the resource window remains bounded according to the shared controller policy

### Requirement: Client runtime store SHALL derive Welcome access state from current catalogs and avatar-local credential validation

The client runtime store SHALL derive `Welcome` room and terminal access state from the current global catalogs plus the validation outcome of any avatar-local room or terminal credential for the target AvatarSession. It SHALL distinguish at least `joined`, `available`, and `credential-invalid`, and it SHALL NOT require a separate durable Welcome preset or draft stack to remember prior selections.

#### Scenario: Welcome selection reflects current validated joins

- **WHEN** the client hydrates `Welcome` for a workspace and avatar target
- **THEN** the selected rooms and terminals are derived from the current catalogs plus currently valid avatar-local credentials for that AvatarSession
- **THEN** the UI reflects joined state without inventing a second remembered preset model

#### Scenario: Invalid credential remains visible as an explicit invalid state

- **WHEN** a previously stored room or terminal token fails validation during hydration
- **THEN** the runtime store does not treat that room or terminal as joined
- **THEN** the corresponding room or terminal remains visible with a `credential-invalid` state while the stale credential record is preserved until a fresh credential replaces it

### Requirement: Client runtime store SHALL collapse unauthenticated global control-plane errors into explicit resource state

When browser-facing global room or terminal hydration hits an authenticated control-plane boundary, the client runtime store SHALL settle those resources into explicit `auth token required` cached state instead of leaving routes to crash on unhandled promise rejection.

#### Scenario: Unauthenticated global room hydration

- **WHEN** global room catalog or room slices are hydrated without an authenticated browser session
- **THEN** the corresponding cached resource resolves as loaded with empty/null data plus an `auth token required` error
- **THEN** route code can render a stable notice without depending on rejected background promises

#### Scenario: Unauthenticated global terminal hydration

- **WHEN** global terminal catalog hydration runs without an authenticated browser session
- **THEN** the cached terminal catalog resolves as loaded with an empty list plus an `auth token required` error
- **THEN** terminal routes can redirect or disable actions without stale authenticated state leaking through

### Requirement: Client runtime store SHALL keep notification projection protocol-native

The client runtime store SHALL preserve shared notification projection as protocol-native `src` plus bucket-based unread aggregates. It SHALL NOT normalize the shared notification contract into kernel-owned `unreadByChat` or `unreadByTerminal` maps.

#### Scenario: Store ingests mixed room and terminal notifications without shared source switches

- **WHEN** the client receives a notification snapshot containing unread items from `msg:` and `tty:` namespaces
- **THEN** it preserves each item's protocol-native `src` and bucket identity
- **THEN** the shared store contract keeps unread aggregates in a source-agnostic shape
- **THEN** feature selectors may derive room or terminal unread views without changing the shared store law

### Requirement: Client runtime store SHALL normalize attention delivery separately from message read and `ai_call` lifecycle

The client runtime store SHALL cache attention delivery projections and attempt history as session-local runtime facts, and SHALL NOT infer AI acceptance from room read-state or from `ai_call.status = "running"`.

#### Scenario: Read progress does not advance delivery projection

- **WHEN** a room message is already marked read for the acting runtime but the related delivery attempt has not yet recorded an `accepted` receipt
- **THEN** the client runtime store keeps the delivery summary at `pending` or `dispatching`
- **AND** Heartbeat selectors do not upgrade that commit to accepted

#### Scenario: Running model call does not imply accepted delivery

- **WHEN** the client receives a running `ai_call` update before any delivery receipt event arrives
- **THEN** the cached delivery summary remains `dispatching`
- **AND** runtime selectors do not infer AI acceptance from the running model-call row alone

#### Scenario: Retry history keeps previous attempts while summary follows the latest one

- **WHEN** one commit is retried after a previous failed attempt
- **THEN** the store preserves the previous attempt history
- **AND** the visible summary for that commit follows the latest attempt's delivery state

### Requirement: Client runtime store SHALL patch delivery truth from live lifecycle events

The client runtime store SHALL ingest explicit dispatch and receipt runtime events as hot slices so hydrated inspection surfaces can update delivery truth without full grouped-data refreshes.

#### Scenario: Dispatch event updates a warm Heartbeat panel

- **WHEN** the store has already hydrated Heartbeat or another runtime inspection surface for one session
- **AND** a dispatch event arrives for that session
- **THEN** the store patches the related delivery summary in place
- **AND** the visible surface does not need a cold reload to show `dispatching`

#### Scenario: Receipt event updates a warm Heartbeat panel

- **WHEN** a receipt event arrives for a hydrated session
- **THEN** the store patches the corresponding delivery summary and receipt history in place
- **AND** the visible surface can show `accepted`, `errored`, `aborted`, or `completed` immediately

#### Scenario: Full delivery snapshot replaces the explicit ledger slice

- **WHEN** a `runtime.attentionDelivery` event arrives for a hydrated session
- **THEN** the store replaces that session's cached delivery projections, dispatches, receipts, watches, and effects from the event payload
- **AND** it does not merge those explicit effects into scheduler state or attention context truth

#### Scenario: Scheduler and delivery stay distinguishable in normalized state

- **WHEN** the store ingests scheduler-signal events, attention preview events, and delivery/effect events for the same session
- **THEN** each category remains cached in its own normalized runtime slice
- **AND** selectors can observe scheduler wake metadata separately from attention contexts and separately from explicit external effects

### Requirement: Client runtime store SHALL keep room read truth message-native

The client runtime store SHALL preserve room read truth in the same shape it is durably stored: on room message rows. When room catalog entries and room snapshots refresh on different schedules, the store MAY update room/channel metadata independently, but it SHALL NOT synthesize or rewrite latest-visible read arrays from a room-level summary projection.

#### Scenario: Room catalog refresh does not rewrite the latest message

- **WHEN** the browser already holds a warm room snapshot with message `m9`
- **AND** a later room catalog refresh updates room metadata before the next forced room snapshot refresh completes
- **THEN** the cached snapshot keeps `m9.readActorIds` and `m9.unreadActorIds` exactly as they came from the snapshot
- **AND** the store does not patch `m9` from any room-level latest-visible summary fields

#### Scenario: Realtime room invalidation refreshes snapshot instead of synthesizing progress

- **WHEN** a realtime room update indicates that a watched room snapshot changed
- **THEN** the runtime store invalidates or refreshes that room snapshot through the room snapshot API
- **AND** the browser learns new read truth from the refreshed message rows rather than from catalog-side room progress synthesis

### Requirement: Client runtime store SHALL expose typed read-only skill browser queries

The client runtime store SHALL expose typed read-only methods for the browser skill surface instead of requiring feature routes to call raw transport clients directly. Those methods SHALL preserve the platform's objective skill/browser facts and SHALL NOT synthesize merged file trees or mutable skill truth in feature code.

#### Scenario: Skills route uses typed store facades for catalog and tree reads

- **WHEN** the Skills workbench needs a built-in, shared, global, or avatar skill catalog and file tree
- **THEN** it can obtain those facts through typed runtime store methods
- **AND** the route does not instantiate its own ad hoc transport layer

#### Scenario: Store methods preserve objective preview classification

- **WHEN** the Skills workbench reads one skill file preview through the runtime store
- **THEN** the returned preview kind and payload match the browser skill surface contract exactly
- **AND** the store does not reinterpret text vs media into multiple incompatible preview shells
