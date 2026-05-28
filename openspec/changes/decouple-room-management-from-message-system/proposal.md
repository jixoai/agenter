## Why

The current `message-system` still mixes too many responsibilities into one runtime/database boundary:

- room durability and room identity
- message-system Contact/source/admin authority
- local transport/server lifecycle
- follow-up scheduler side effects
- assumptions about one implicit local system instance

That shape blocks the next architecture step the user has now made explicit:

- a single room should be able to connect to multiple message systems
- room durability should be a separate `room management` boundary rather than a hidden sub-part of one message-system instance
- each message system instance should have its own stable `systemId`
- the default local message system should remain the global singleton for the current superadmin, with a 1:1 relationship between `superadmin` and that default `systemId`
- room durability should carry one explicit `superKey` that links the room to the controlling superadmin independently from room membership
- later remote message systems should connect through the same room-management contract over RPC rather than through ad-hoc bridge fields

The user also made the migration policy explicit:

- this is a breaking refcontact
- do not preserve backward compatibility
- clear the old local message databases
- land the cleaner long-term architecture directly

## What Changes

- **BREAKING** split room durability into a new `room management` boundary that is independent from `message-system` authority/runtime concerns.
- **BREAKING** redefine `message-system` as a superadmin-bound messaging authority/runtime that manages Contacts, source subscriptions, signatures, keys, and room participation against one room-management backend.
- Introduce explicit `systemId` ownership:
  - the default local message-system is the global singleton for the current superadmin
  - that default instance has one stable `systemId`
  - that `systemId` is the current superadmin address in this version
  - future additional local message-system instances can be created from a supplied key and will get distinct `systemId`s
- Introduce explicit room `superKey` ownership:
  - each room carries one `superKey`
  - `superKey` is not a room member seat
  - `superKey` may read transcript truth and manage room configuration/membership/archive/delete
  - `superKey` does not automatically gain the right to send chat messages as a room participant
- Require room durability to record source provenance per message and per room-side event using the producing `systemId`.
- Record the remote direction explicitly:
  - do not keep adding local-only follow-up/bridge hacks
  - remote message-system instances must eventually expose the same room-management contract over RPC/pub-sub
- Record frontend impact explicitly:
  - room management UI must separate "room control identity" from "send/view as participant"
  - Studio is the superadmin-facing product, so `superKey` / `systemId` / domain-source metadata should stay available but low-emphasis, usually inside metadata/manage surfaces rather than the main chat focus path
  - `web-chat-view` remains the ordinary-user-focused transcript/composer surface and should not be polluted with superadmin-heavy room-management chrome
  - room detail remains readable when the operator holds `superKey` control but does not hold a sending seat
- Reset local message durability instead of carrying forward the old schema.
- Drive the migration with BDD and repeated review gates so room-management law, message-system law, and RPC law do not drift apart during implementation.
- Before broad Studio chat-surface rewrites, import or port the Framework7-based `web-chat-view` baseline from the dedicated review-shell worktree and re-evaluate the host boundary (`direct host` / `custom element` / `iframe`) against the real implementation rather than guesswork.

## Capabilities

### New Capabilities

- `room-management-control-plane`
- `message-system-instance-identity`
- `room-management-rpc-contract`

### Modified Capabilities

- `message-chat-control-plane`
- `message-system-surface`
- `session-runtime-attention-message`

## Impact

- Affected packages: `@agenter/message-system`, `@agenter/app-server`, `agenter-ext-studio`
- New package/spec surface likely required for room durability ownership, even if the first implementation still lands inside existing package boundaries
- Existing local message databases will be intentionally invalidated/reset
- Existing remote assumptions around managed-seat / follow-up transport should be treated as obsolete and redesigned from the new room-management boundary upward
