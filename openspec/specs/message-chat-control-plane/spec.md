# message-chat-control-plane Specification

## Purpose
Define the global room-first message control plane, its transport contract, and the model-facing semantics for collaboration across auth actors and session actors.
## Requirements
### Requirement: Message-system SHALL manage multiple chat channels

The message control plane SHALL manage multiple global room resources independently from session lifecycles. Auth actors and session actors MAY attach to the same room, room durability SHALL NOT depend on any single session remaining alive, room-local read-state SHALL remain durable as per-message frozen read membership rather than mutable actor read cursors, and durable room messages SHALL NOT encode AI scheduling or cycle queue state.

#### Scenario: One room is shared by human and session actors
- **WHEN** an auth actor and one or more session actors are granted access to the same room
- **THEN** each actor can observe or contribute according to its grant
- **THEN** the room history remains one shared durable timeline instead of per-session copies

#### Scenario: Same avatar label can appear as separate session seats
- **WHEN** two different session actors that happen to share the same avatar label join one room
- **THEN** the room transport and access model still treat them as separate session actors
- **THEN** collaboration state is keyed by actor identity rather than by the visible label alone

#### Scenario: Room survives session stop
- **WHEN** the last attached session for a room stops or is deleted
- **THEN** the room definition, grants, history, and assets remain available in the global message store
- **THEN** a later auth actor or session actor can reattach to that same room

#### Scenario: Authorized text input becomes a durable visible room fact without AI state
- **WHEN** a member sends a text message through an authorized chat transport
- **THEN** the message is persisted immediately as a durable visible room fact in send order
- **THEN** the stored room message keeps canonical sender identity and frozen read arrays
- **THEN** the stored room message does not add an AI-specific queue or load field

#### Scenario: Assistant-visible output is immediately visible
- **WHEN** the runtime or assistant writes a visible reply or structured error through the control plane
- **THEN** the message is persisted as already loaded and visible
- **AND** it does not enter any queued-only room presentation mode

#### Scenario: Room read-state survives session stop
- **WHEN** a room has message-level durable read-state and one contributing session later stops
- **THEN** the room history and room read-state remain available in the global message store
- **THEN** a later actor reattaching to that room can still observe the current read progression without recomputing prior message membership

### Requirement: Durable room writes SHALL survive stale room-database handles and expose explicit idempotency keys

Room message writes SHALL recover from stale cached room-database handles by closing and reopening the room database before surfacing failure, and client-driven retry safety SHALL use an explicit durable `clientMessageId` contract rather than content guessing.

#### Scenario: Stale cached room database handle is reopened on the next write
- **GIVEN** a room already exists and its cached room database handle has gone stale
- **WHEN** the next authorized room write targets that same room
- **THEN** message-system closes the stale handle, reopens the room database, and retries the write once
- **THEN** the durable room message is persisted without requiring app-specific retry glue

#### Scenario: Retrying the same logical room send does not create a second durable row
- **GIVEN** a caller sends an authorized room message with durable `clientMessageId = X`
- **WHEN** the same caller retries the same logical room send with `clientMessageId = X`
- **THEN** message-system returns the already persisted durable room message
- **THEN** room history still contains exactly one durable row for `clientMessageId = X`
- **AND** the retry is not treated as a second new-message event

### Requirement: Message control plane SHALL expose unread room summaries and unread subscriptions

The message control plane SHALL expose authorized unread summary reads and actor-scoped unread subscriptions so runtimes can discover unread room work without scanning whole room histories.

#### Scenario: Authorized runtime reads unread room summaries
- **WHEN** an authorized runtime reads unread summaries for actor `A`
- **THEN** the control plane returns per-room unread counts, latest unread ordering facts, and the latest durable read floor for `A`
- **THEN** the runtime can rank rooms without paging the full message history of every room

#### Scenario: Authorized runtime waits on unread state instead of polling room rows
- **GIVEN** actor `A` currently has no unread rooms
- **AND** a runtime is waiting on `A`'s unread subscription through the control plane
- **WHEN** a new unread room message is persisted for `A`
- **THEN** the unread wait resolves
- **THEN** the runtime can perform one new unread summary read instead of polling all room rows

### Requirement: Room lifecycle SHALL distinguish archive from dissolve

Room lifecycle APIs SHALL expose archive as a reversible visibility action and dissolve/delete as a destructive removal action. Room-backed `AttentionContext` lifecycle MAY become one of the canonical causes that drives a room into that archived state, and room provenance metadata such as `builtIn` SHALL NOT by itself suppress global cleanup affordances.

#### Scenario: Admin dissolves a legacy bootstrap room
- **WHEN** an admin deletes a room that still carries legacy bootstrap provenance metadata
- **THEN** the room can still be dissolved through the normal room lifecycle API
- **AND** the room's provenance metadata does not by itself block destructive cleanup

#### Scenario: Companion muted context archives the room without dissolving it
- **WHEN** a room-backed `AttentionContext` enters `muted`
- **THEN** message-system may mark the companion room as `archived`
- **AND** the room remains readable, addressable, and durable
- **AND** the room is not dissolved or deleted by that lifecycle change

### Requirement: Room participant membership SHALL not encode actor-kind identity roles

Room participant lists SHALL model room seat membership only, not `avatar|user|system` identity-role labels, and message-system SHALL persist only canonical actor-backed participant ids.

#### Scenario: New room write strips legacy participant ids
- **WHEN** the client creates or updates a room participant list containing legacy ids such as `avatar:*` or bare `user`
- **THEN** the write persists only canonical `auth:` / `session:` / `system:` participant ids
- **AND** invalid legacy ids are removed instead of being preserved in durable room truth

#### Scenario: Bootstrap repair rewrites an old room with canonical participants
- **WHEN** app-server reattaches to an existing room whose stored participant list still contains invalid legacy ids
- **THEN** the room is rewritten with the normalized canonical participant list
- **AND** subsequent room reads stop surfacing those invalid legacy participants

### Requirement: Room metadata SHALL distinguish direct rooms from public rooms

The message control plane SHALL represent both direct and public conversations as `kind: "room"` channels, while room metadata SHALL explicitly encode whether the room is `direct` or `public`.

#### Scenario: Direct room persists metadata without changing room kind
- **WHEN** the system creates a paired direct-room conversation for two contacts
- **THEN** each local channel is persisted as `kind: "room"`
- **THEN** each local channel metadata includes `roomMode: "direct"`

### Requirement: Direct rooms SHALL remain strict one-to-one rooms

The message control plane SHALL enforce direct rooms as strict one-to-one rooms between exactly two durable participants. A direct room SHALL NOT be expanded in place into a multi-party room.

#### Scenario: Direct room cannot gain a third participant in place
- **WHEN** an operator or runtime attempts to invite a third actor into an existing direct room
- **THEN** the existing direct room remains one-to-one
- **THEN** the system rejects in-place expansion of that direct room

### Requirement: Inviting from a direct room SHALL branch into a new public room

If a user flow starts from a direct room and asks to invite an additional participant, the control plane SHALL create a new `public` room and attach the requested participants there instead of reusing the direct room.

#### Scenario: Third-party invite from direct room creates public room
- **WHEN** actor `A` and actor `B` already share direct room `D`
- **AND** `A` invites actor `C` from that direct-room context
- **THEN** the system creates a new room `P`
- **THEN** `P` metadata includes `roomMode: "public"`
- **THEN** `D` remains the original one-to-one room between `A` and `B`

### Requirement: Paired direct-room bootstrap SHALL preserve two local durable histories

When a contact acceptance bootstraps a direct conversation, each source SHALL persist its own local room and its own durable transcript while storing enough pairing metadata to continue syncing direct-room messages with the remote side.

#### Scenario: Two sources keep independent room durability for one direct conversation
- **WHEN** actor `A` on source `SA` and actor `B` on source `SB` bootstrap a direct-room conversation
- **THEN** source `SA` persists its local direct room and transcript
- **THEN** source `SB` persists its local direct room and transcript
- **THEN** later direct-room message sync appends to both local durable histories instead of treating one side as the only room of record

### Requirement: Global room ids SHALL be principal ids

New global rooms SHALL be allocated from managed room principals, and the control plane SHALL reject legacy non-principal room ids for new durable room writes.

#### Scenario: New room id is a room principal
- **WHEN** the client creates a new global room without an explicit `chatId`
- **THEN** the returned room id is a lowercase `0x...` principal id
- **AND** that room id is backed by persisted managed principal material

#### Scenario: New room write rejects legacy `room-*` ids
- **WHEN** a caller attempts to create a new room with a legacy synthetic id such as `room-main-*` or `room-team`
- **THEN** the write is rejected instead of creating new durable room truth under that legacy id
- **AND** only lowercase `0x...` principal ids remain valid for new room creation

#### Scenario: Breaking schema reset removes legacy room durability
- **WHEN** message durability is opened after the principal-only room-id migration
- **THEN** older durable rows that may still contain legacy `room-*` room ids are cleared by the breaking reset
- **AND** new durability created after that reset stores only principal-backed room ids

### Requirement: Principal ids SHALL be accepted as room actors

Room actor validation SHALL accept raw principal ids for new runtimes and authenticated users.

#### Scenario: Avatar runtime joins a room as a principal
- **WHEN** a session runtime binds to an avatar principal id
- **THEN** room focus, grants, and message visibility can use that principal id directly
- **AND** the control plane does not require `session:<id>` for new runtimes

### Requirement: Chat transport SHALL expose snapshot and incremental messages

A room transport endpoint SHALL deliver an initial room snapshot followed by incremental message updates for that global room, regardless of whether any session runtime is currently active. Authorized room page reads SHALL remain available as the stable source for loading older transcript windows in app views such as cli-shell Chat.

#### Scenario: Web client connects to a room endpoint
- **WHEN** a websocket client connects to an authorized room transport endpoint
- **THEN** the server sends the room snapshot first
- **THEN** later sends append or upsert events for new or updated messages in that room

#### Scenario: Room transport stays available without a running session
- **WHEN** a client reads or pages a room whose prior contributing session is no longer running
- **THEN** the message control plane still returns the durable room snapshot and history
- **THEN** the client does not depend on reviving the old session to read that room

#### Scenario: Message lifecycle updates arrive as incremental upserts
- **WHEN** a room message is later edited, recalled, or marked as attention-loaded
- **THEN** the transport pushes the updated message record with the same `messageId`
- **AND** the client can update transcript placement and lifecycle state without reloading the whole channel

#### Scenario: App transcript views page older history from room truth
- **GIVEN** a app transcript view has loaded a recent room snapshot with `nextBefore` and `hasMoreBefore`
- **WHEN** the app needs older messages before the current window
- **THEN** it reads an authorized room page using `before = nextBefore`
- **AND** the returned page updates `nextBefore` and `hasMoreBefore`
- **AND** the app does not create a second durable transcript store to support incremental loading

### Requirement: Durable room messages SHALL support sender-authored recall

The message control plane SHALL let the original sender recall their own durable room message without changing that message's `messageId`, frozen read membership, or place in the room timeline. A recalled message SHALL expose explicit recall metadata and SHALL no longer expose its stale user-visible body as if it were still the active room truth.

#### Scenario: Sender recalls their own durable room message
- **WHEN** the original sender recalls a previously sent room message through an authorized room credential
- **THEN** the control plane keeps the same `messageId`, `createdAt`, and frozen read arrays
- **THEN** the updated room record exposes explicit recall metadata
- **THEN** the room record no longer returns the stale original body as the current visible message content

#### Scenario: Different participant cannot recall another sender's room message
- **WHEN** a different ordinary room member attempts to recall someone else's durable room message
- **THEN** the control plane rejects the mutation
- **THEN** the target message remains unchanged in durable room truth

#### Scenario: Recalled message remains a durable room fact
- **WHEN** a room snapshot, page read, or incremental transport update includes a recalled message
- **THEN** that recalled message still appears in its original timeline position
- **THEN** consumers can tell that the message was recalled from the durable record itself instead of inferring it from a synthetic follow-up row

### Requirement: Room messages SHALL preserve durable acting actor identity

The message control plane SHALL persist the canonical acting actor identity for each room message in addition to any display label, and every snapshot, page, and incremental transport payload SHALL expose that durable sender identity unchanged.

#### Scenario: Same-label actors send distinct room messages
- **WHEN** two different actors with the same visible label both send messages into one room
- **THEN** the persisted message records keep distinct canonical actor identities for each send
- **THEN** room transport consumers can distinguish those sends without inferring identity from labels

#### Scenario: Send-as authority becomes durable message fact
- **WHEN** an operator chooses a room token and sends a message as that actor
- **THEN** the resulting room message persists the selected acting actor identity
- **THEN** later snapshot or page reads preserve that identity even after refresh or reconnect

### Requirement: Global room messages SHALL persist attachment references from room-owned assets

The global room message control plane SHALL allow room text messages to reference previously uploaded room-owned asset identifiers. When a room message is sent with authorized room asset ids, the persisted room message record MUST expose the corresponding attachment metadata through snapshot, page, and incremental transport reads.

#### Scenario: Room send stores attachment references
- **WHEN** an authorized caller sends a global room message with one or more uploaded room asset identifiers
- **THEN** the stored room message includes those attachment references
- **THEN** later room snapshot, page, and transport reads expose the same attachment metadata for transcript rendering

#### Scenario: Room attachment history survives reconnect
- **WHEN** a client reconnects to a room that already contains messages with room-owned attachments
- **THEN** the control plane still returns those attachment references with the durable room history
- **THEN** the client does not need a running session runtime to reconstruct the room attachment timeline

### Requirement: Message-system SHALL define communication semantics through skills and attention

The message control plane SHALL express room-facing obligations through durable message facts and attention items, and the owning message skill guidance SHALL describe message-system as an asynchronous multi-channel communication surface. That guidance SHALL teach role-aware dispatch instead of reducing room CLI usage to mechanical quote forwarding, and it SHALL explicitly teach post-send revision behavior through `message read`, `message edit`, and `message recall`.

#### Scenario: Message skill teaches role-aware relay
- **WHEN** room work requires the assistant to use message-system
- **THEN** the message skill explains that the assistant must first decide whether it is replying, relaying, judging, coordinating, or notifying
- **AND** relay messages are composed for the target participant instead of blindly copying the originating user's raw sentence

#### Scenario: Message attention items preserve assistant role boundaries
- **WHEN** the assistant is asked to mediate or judge between channels
- **THEN** the message skill and message-shaped attention items remind it not to speak as another participant
- **AND** lack of a user reply in one channel does not block unrelated work elsewhere in the runtime

#### Scenario: Message skill distinguishes send edit and recall
- **WHEN** the assistant already has a durable room message and later learns it is incomplete, stale, or should be withdrawn
- **THEN** the skill explains when to send a second message, when to edit the prior message in place, and when to recall it before replying again
- **AND** the guidance treats `send`, `edit`, and `recall` as separate message-system actions rather than as one overloaded command

#### Scenario: Post-send revision guidance reads room context before withdrawing duplicates
- **WHEN** the assistant has just sent a durable room message and the returned recent room summary suggests that two of its recent messages may be accidental duplicates
- **THEN** the guidance instructs the assistant to inspect room context with `message read` before acting
- **AND** that reread includes direct referenced room context when present
- **AND** the assistant withdraws or edits a message only when the duplicate is a contextual mistake rather than a deliberate repeated response

### Requirement: Durable room messages SHALL use explicit same-room reply references

The message control plane SHALL expose an optional numeric `ref` on durable room messages to represent “this room message replies to that other durable room message in the same chat”. Room messages MUST NOT expose runtime cycle ids, attention commit ids, or any other internal routing anchor as part of this reply-reference field.

#### Scenario: Authorized room send stores a same-room reply reference

- **WHEN** an authorized caller sends a room message with `ref` pointing to another durable `messageId` in the same room
- **THEN** the persisted room message stores that reply reference as durable room truth
- **THEN** later snapshot, pagination, and incremental transport reads expose the same `ref` unchanged

#### Scenario: Internal anchors do not become room reply references

- **WHEN** a caller attempts to send a room message with a non-room anchor such as a runtime cycle id, attention id, or another non-message token in the reply-reference field
- **THEN** the control plane rejects that write instead of persisting the value as durable room truth
- **THEN** room messages remain free of runtime or attention routing residue

#### Scenario: Referenced message lifecycle stays objective

- **WHEN** a room message references another durable room message that is later edited or recalled
- **THEN** the referencing message keeps the same `ref`
- **THEN** later room reads can still resolve the referenced durable message and observe its current objective lifecycle state

### Requirement: Model-facing room sends SHALL keep follow-up reminder intent out of durable room truth

Model-facing room sends MAY include an optional `followUpAfterMs` reminder intent for the sending runtime. When present, the control plane SHALL bind that reminder to the successfully sent durable `messageId`, persist one message-system follow-up task outside the durable room message row, and keep follow-up scheduling fields out of room snapshot payloads and incremental room transport updates. That reminder SHALL remain eligible only while the anchored message is still the latest visible room message in the room.

#### Scenario: Send with a follow-up reminder still persists a normal durable room message

- **WHEN** an authorized runtime sends a room message with `followUpAfterMs`
- **THEN** the durable room message is appended normally with the same visible room fields other readers expect
- **AND** one follow-up task is bound to that sent `messageId` in message-system local durability instead of being serialized into shared room truth

#### Scenario: Room durability reloads pending follow-up tasks

- **GIVEN** a room message already persisted a follow-up task
- **WHEN** message-system runtime starts again before the task is due
- **THEN** message-system reloads that task from room durability
- **AND** it re-arms the due timer without requiring session-runtime to restore a legacy runtime watch

#### Scenario: Room transport does not leak sender-private reminder state

- **WHEN** another authorized room reader later receives a snapshot, page read, or incremental transport update for that message
- **THEN** the payload does not expose `followUpAfterMs`, due times, or sender-private reminder lifecycle state
- **AND** shared room truth remains free of AI scheduling residue

#### Scenario: Newer visible room activity suppresses the older reminder

- **WHEN** a later visible room message appears before the anchored reminder reaches due time
- **THEN** the older reminder is no longer eligible to create later follow-up debt
- **AND** stale silence from the superseded message does not reopen the room by itself

### Requirement: Message skill SHALL teach follow-up reminders as etiquette-driven re-evaluation

The owning message skill guidance SHALL describe `followUpAfterMs` as an optional, one-shot etiquette aid for deciding later whether a room still needs feedback. That guidance SHALL not present the field as a mandatory rule, as a transport timeout, or as permission to auto-send a visible room message without another model decision.

#### Scenario: Long-running acknowledgement may arm a follow-up reminder

- **WHEN** the assistant sends a brief acknowledgement before longer work and wants to revisit the room if silence continues
- **THEN** the message skill may recommend `followUpAfterMs` on that acknowledgement
- **AND** the later action remains an explicit decision about whether another room reply is actually needed

#### Scenario: Skill guidance keeps follow-up reminders optional

- **WHEN** the assistant already has enough evidence for the final answer or later room activity has already changed the situation
- **THEN** the message skill does not require `followUpAfterMs`
- **AND** it does not frame the reminder as universal policy for every room message

### Requirement: Room seat management SHALL onboard shared principals through invitation acceptance

The message control plane SHALL let the current room admin or superadmin create, update, and revoke managed seat invitations for a target principal without issuing room authority until the target accepts. `message-manage invite` and `message-manage accept` SHALL be projections over these control-plane operations, not separate room truth.

#### Scenario: Current room admin issues a room invitation

- **WHEN** the current room admin invites principal `P` to room `R` with room role `member`
- **THEN** the control plane records a pending room seat invitation for `R` and `P`
- **THEN** `P` does not yet receive an active room access token or active room grant

#### Scenario: Accepted room invitation activates the seat

- **WHEN** principal `P` successfully accepts its pending invitation for room `R`
- **THEN** the control plane creates or reuses the room-native seat for `P`
- **THEN** the acceptance returns `P`'s active room access projection including the room access token
- **THEN** subsequent room reads or writes for `P` follow the native room role law

#### Scenario: Room admin authority joins the current-admin candidate law

- **WHEN** principal `P` accepts a room invitation with room role `admin`
- **THEN** the resulting seat is resolved to the room-native admin payload
- **THEN** `P` is inserted into the room's admin-candidate set
- **THEN** current-admin resolution still follows the existing room current-admin law instead of creating parallel unconditional room admins

### Requirement: Room seat mutation SHALL remain a manager containment power

Room `config` and `revoke` operations SHALL remain unilateral actions for the current room admin or superadmin. Reconfiguring an accepted seat SHALL update the room-native grant law in place, and revoking a seat SHALL also invalidate any pending invitations and clear the target actor's room-local authority when no other active seat remains.

#### Scenario: Config changes an accepted room seat

- **WHEN** the current room admin changes principal `P` in room `R` from `readonly` to `member`
- **THEN** the control plane updates `P`'s active room seat to the room-native member payload
- **THEN** `P` does not need to accept a second invitation only because the role changed

#### Scenario: Revoke removes active and pending room authority

- **WHEN** the current room admin revokes principal `P` from room `R`
- **THEN** any active room grant for `P` on `R` is revoked
- **THEN** any pending invitation for `P` on `R` becomes invalid
- **THEN** room-local state for `P` is cleared when `P` no longer has any other active seat on `R`

### Requirement: Room message writes SHALL keep WebChat resource projections out of backend metadata

The global room message control plane SHALL treat the room message `content` string as the only durable carrier for WebChat-authored resource-reference text. Backend message metadata SHALL remain reserved for platform-owned facts such as idempotency, lifecycle, transport, or other explicitly specified control-plane facts. WebChat frontend projection payloads such as `webChatCommentResources`, `webChatResourceReferences`, or equivalent app-view resource sidecars MUST NOT be persisted into room message metadata. Comment, image, file, and video resource references that need to survive reload or reach runtime/AI ingress MUST be represented in the raw Markdown `content` using WebChat-owned footnote syntax, while room-owned uploaded asset attachments MAY continue to persist through the separate attachment-reference contract.

#### Scenario: WebChat comment send persists Markdown content only

- **WHEN** an authorized WebChat app-view caller sends a room message containing a comment resource
- **THEN** the stored room message `content` includes the inline comment reference and its Markdown footnote definition
- **AND** the stored room message metadata does not contain `webChatCommentResources` or an equivalent WebChat resource sidecar
- **AND** later runtime and AI message ingress can read the comment body from `message.content` without consulting metadata

#### Scenario: Backend strips forbidden WebChat resource metadata at the room write boundary

- **WHEN** a browser or app-view caller submits room message metadata containing `webChatCommentResources` or another WebChat resource-projection key
- **THEN** the backend does not persist that key into the durable room message metadata
- **AND** the response, snapshot, page read, and incremental transport payloads do not expose that key as room truth
- **AND** missing Markdown resource definitions are treated as caller serialization failure rather than repaired by preserving hidden metadata

#### Scenario: Legacy polluted room rows are repaired into Markdown source

- **GIVEN** an existing durable room message stores an inline resource token in `content` and the matching comment body in `metadata.webChatCommentResources`
- **WHEN** the legacy repair path runs for that room database
- **THEN** the message `content` is rewritten to include the canonical Markdown footnote definition for the comment resource
- **AND** `metadata.webChatCommentResources` is removed from the durable metadata
- **AND** re-running the repair path does not duplicate footnote definitions or reintroduce frontend projection metadata
