## Context

The user has now defined a stronger boundary than the current repo:

- `message-system` is not the owner of rooms
- `room management` is the owner of room durability
- `message-system` is a system instance that serves one superadmin root by default, but may also serve many registered Contacts under that system
- multiple message-system instances should eventually be able to publish/subscribe against the same room-management backend
- remote instances should appear as the same architecture over RPC, not as a second-class bridge full of local exception fields

This is not a compatibility tweak. It is a deliberate architecture reset.

## Goals / Non-Goals

**Goals**

- separate room durability from message-system authority/runtime concerns
- introduce stable `systemId` identity for each message-system instance
- keep one default local singleton message-system for the current superadmin
- allow future additional local message-system instances created from explicit keys
- make room durability record which system instance produced each message/event
- define a room-management contract that can later be exposed over RPC/pub-sub without changing the core law
- introduce explicit room `superKey` control that is independent from room membership
- wipe old local message durability instead of carrying mixed-schema baggage
- drive the refcontact through BDD and review gates

**Non-Goals**

- do not support one message-system instance talking to multiple room-management backends in this change
- do not preserve backward compatibility with the old local message databases
- do not solve every remote auth/proof flow in this first pass; define the contract first, then implement the local-first path against it
- do not turn `room management` into another superadmin-bound system; it is a durable shared backend boundary, not a peer system in the same ownership category

## Decisions

### Decision 1: Room management is a separate durability/control boundary

Room durability becomes its own boundary:

- room identity
- room transcript truth
- room membership/grants as persisted room facts
- room-side publish/subscribe state
- room-side source provenance, including `systemId`

Why:

- rooms must outlive any one message-system runtime instance
- multiple message systems must be able to participate in the same room truth
- this is closer to a database/pub-sub backend than to a superadmin-owned product system

Rejected alternative:

- keep rooms as hidden internals of `message-system`
  - rejected because it prevents clean multi-system participation and keeps source ownership ambiguous

### Decision 2: Message-system becomes a system instance with stable identity

Each message-system instance has:

- one stable `systemId`
- one superadmin root authority
- many registered Contacts/users that use the same message-system through their own keys
- one attached room-management backend for this phase

The default local message-system remains a global singleton and is 1:1 with the current superadmin.
In this version, `systemId` is the superadmin address.

Why:

- this preserves the user's law that systems are superadmin-bound
- it explains why the existing local message-system serves the superadmin
- it also preserves the ability for one message-system to serve multiple Contacts/users

Rejected alternative:

- treat every Contact/user as its own message-system
  - rejected because the user explicitly wants one message-system to be able to serve multiple registered Contacts

### Decision 2.1: Room control uses `superKey`, not implicit membership

Each room carries one explicit `superKey`.

`superKey`:

- is bound to a superadmin identity
- is not a room member seat
- may read transcript truth
- may create the room remotely/local-first
- may add/remove members and mutate room configuration
- may archive/delete the room as room-domain lifecycle mutations
- may not send room chat messages unless it also holds a participant seat through normal room membership

Why:

- the user wants remote room creation/control without lying that the superadmin is automatically "in the room"
- this separates room control authority from room participation truth
- frontend and runtime can now express "control-only" access cleanly

Rejected alternative:

- make the room controller also be a hidden/admin participant
  - rejected because it pollutes room membership truth and collapses control identity into chat participation

### Decision 2.2: UI names should favor `Domain` / `Source`, not `Control`

When this room-level authority appears in UI, it should prefer labels like `Domain` or `Source` rather than `Control`.

Why:

- the user explicitly does not want this rendered as a loud operator-control badge
- the concept is durable ownership/provenance, not a constant primary workflow action

### Decision 3: Source provenance must be first-class durable truth

Room durability must record:

- which `systemId` produced a room message
- which `systemId` produced room-side lifecycle/admin events
- enough stable source provenance to support local multi-system and future remote multi-system participation

Why:

- once multiple message systems can talk to one room backend, provenance is not optional metadata
- source identity must be durable truth, not an inferred runtime detail

### Decision 4: Local-first architecture, remote-ready contract

This change starts from local room-management + local message-system instances.

But the contract must be shaped so that:

- the same room-management API can later be exposed over RPC
- publish/subscribe semantics are network-native
- remote support does not require reopening every local type and adding transport-only exception fields

Why:

- the user explicitly rejected more ad-hoc remote pollution
- the contract should be RPC-shaped from day one even if the first implementation runs in-process

### Decision 5: Breaking migration means database reset

Old local message durability is cleared.

Why:

- the current schema encodes the old ownership model
- compatibility glue would drag old confusion into the new law
- the user explicitly requested a hard reset

Implementation expectation:

- bump/reset the local message durability schema aggressively
- document that old local room/message data is intentionally discarded

## Architecture Shape

### Room management boundary

Room management owns:

- room catalog
- room transcript storage
- room revision / transcript revision
- room-side pub/sub
- source provenance by `systemId`
- room `superKey`
- room-backed archived/active lifecycle projection

It does **not** own:

- superadmin identity
- Contact private keys
- contact catalog semantics
- attention truth

### Message-system boundary

Message-system owns:

- `systemId`
- default superadmin-bound singleton lifecycle
- additional keyed local instance creation
- Contact registration / Contact usage
- contacts and source subscriptions
- signatures/proofs/credentials needed to act through room management
- higher-level room operations performed on behalf of its Contacts

It does **not** own:

- room durability itself
- transcript truth as a private database

### RPC boundary

The future RPC contract should expose room-management operations, not local message-runtime implementation details.

That implies:

- room-management methods should already be designed like network-safe control-plane calls
- pub/sub should already be modeled like a transport contract
- `message-system` should consume that contract locally first, remotely later

## Frontend Impact

The current frontend largely assumes:

- the current room controller is also a room member
- room management actions are driven by the same seat/access token used for chat participation
- one implicit local message-system owns the visible room catalog

Those assumptions are no longer valid.

Required frontend direction:

- `web-chat-view` remains the ordinary-user-facing chat product
- Studio wraps that surface and adds superadmin-only room/domain/source controls outside the main transcript focus path
- room detail must separate:
  - room domain/source capability via `superKey`
  - transcript read capability
  - send/view-as-participant capability via room seats
- manage dialogs must work even when the operator has no sending seat
- composer disable state must not imply "you cannot manage this room"
- workbench/catalog surfaces should be ready to reveal room provenance and later multi-system participation instead of pretending all rooms belong to one unnamed local instance

The "superKey but no seat" state is not a special product mode. It is the straightforward result of independent capabilities:

- can manage room because `superKey` is present
- can read transcript because room-domain authority allows reading
- cannot send because no participant seat is selected/granted

So the UI should not fork into an exotic alternate page. It should render the same room detail shell while letting capabilities naturally enable/disable.

### Current Studio wrapper constraint

The current Studio route still consumes `PublicRoomEntry` / `PublicRoomSnapshot`, which only expose bootstrap room access plus durable participant/grant truth. They do **not** yet expose first-class room-management `superKey` / `systemId` / `domain` / `source` facts as durable fields.

So the current wrapper law is:

- Studio may show capability truth that is already real:
  - transcript readable
  - room management available
  - send unavailable without a real member/admin seat
- Studio must **not** synthesize fake participant seats or fake send identities from bootstrap control access
- low-emphasis `domain/source/systemId/superKey` UI must wait until those facts are exposed by room-management truth rather than inferred from legacy bootstrap projections

Current repo truth:

- `@agenter/web-chat-view` is already embedded directly in Studio as a component host today
- there is no confirmed Framework7-Svelte integration in the current repo truth yet
- there is also no current iframe embedding for room chat
- the dedicated candidate worktree is `.worktree/web-chat-view-review-shell`
- that candidate branch does contain a Framework7-based review shell baseline and expanded `@agenter/web-chat-view` surface, but it is not merged into this worktree yet
- the candidate worktree currently also carries uncommitted changes, so it cannot be treated as a clean drop-in merge source without another review step

Iframe embedding remains a candidate direction for stronger product isolation, but it should be evaluated against resize, auth, read-state, action callback, and theme-sync costs before being frozen as law.

Current merge implication:

- do not freeze `iframe` as law before importing the real Framework7 baseline
- first land a minimal Framework7-capable `web-chat-view` baseline into this worktree
- then evaluate `direct host` vs `custom element` vs `iframe` using the same chat host contract and Studio wrapper requirements

## BDD / Review Plan

### Review A

Confirm the split between:

- room management as backend/shared durability
- message-system as superadmin-bound authority/runtime
- future RPC as contract exposure, not local exception patching

### Review B

After failing BDD is written, confirm:

- one default local singleton message-system maps 1:1 to the current superadmin
- one room-management backend can serve multiple local message-system instances
- source provenance by `systemId` is durable truth
- `superKey` control is not mis-modeled as a hidden room member

### Review A.1

After the Framework7 candidate worktree is audited, confirm:

- which committed baseline should be imported first from `feature/web-chat-view-review-shell`
- which uncommitted candidate changes must stay out until separately reviewed
- whether Studio should keep direct component hosting for the first integration pass or switch boundaries later

### Review C

After the first implementation slice, confirm:

- repo truth no longer implies rooms belong to one message-system database
- runtime/studio surfaces no longer use legacy language that hides `systemId` or room-management ownership
- frontend surfaces no longer collapse room control and room participation into one contact/token concept
- Studio keeps domain/source metadata available but low-emphasis, while `web-chat-view` stays focused on ordinary chat behavior

## Risks / Trade-offs

- [Large breaking surface] → keep phases explicit and drive from BDD instead of broad unstructured rewrites.
- [Old `message-system` names may become misleading] → accept local renames or new package/spec boundaries where needed instead of preserving inaccurate names forever.
- [RPC may still bias local APIs if designed too early] → keep the contract minimal and control-plane shaped; avoid transport-specific leakage.
- [Room grants may sit awkwardly between room management and message-system] → treat persisted room membership as room truth, while message-system owns the contact-side authority/proof to request those changes.

## Implementation Phases

1. Write durable law/specs for room management, message-system instance identity, and RPC-shaped room contract.
2. Add failing BDD that proves one room backend can accept messages from distinct local `systemId`s.
3. Extract/reset durability so room transcript truth no longer lives as a private sub-database of one message-system instance.
4. Introduce default local singleton message-system identity and explicit keyed local instance creation.
5. Rewire message-system operations to act against room management instead of private room durability.
6. Rework studio/runtime inspection surfaces to show room-management truth, `systemId` provenance, and `superKey` domain/source capability vs participant capability cleanly.
7. Import or port the Framework7 `web-chat-view` baseline from the dedicated review-shell worktree before broad Studio room-shell rewrites.
8. Run review/deviation audit before any remote implementation begins.
