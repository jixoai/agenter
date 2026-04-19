## Context

The current runtime still treats source identity as a hard-coded tuple of `systemId` / `subjectId` / `channelId`. That tuple leaks from `LoopBusPluginRuntime` into attention commits, notification projection, runtime publication, and client/UI state. The result is the opposite of the intended platform law: adding a new source family still requires touching shared branching code in multiple layers.

The current notification path shows the same problem. `session-notifications.ts` hard-codes message and terminal parsing, `consumeNotifications()` accepts `upToMessageId`, and shared snapshots expose `unreadByChat` / `unreadByTerminal`. That makes message-system the accidental owner of a supposedly shared attention projection.

`web-chat-view` has a second, related identity leak. Its shared transcript model still uses a string `messageId` for UI merge and fixture convenience, while the durable room message contract already uses numeric `messageId`. The package is therefore conflating a view-layer key with the durable room primary key.

This change is intentionally cross-cutting. It updates attention contracts, registry behavior, notification projection, runtime/client APIs, and the shared web chat package in one destructive pass.

## Goals / Non-Goals

**Goals:**
- Introduce a shared namespace registry for attention source addresses, with protocol-native `src` as the only shared source identifier.
- Remove message-specific notification fields and notification parsing branches from shared runtime layers.
- Make notification grouping and consumption rely on namespace-owned bucket/comparison rules rather than chat/terminal-specific fields.
- Split `web-chat-view` identity into `viewKey` for UI lifecycle and numeric `messageId` for durable room truth.
- Keep the migration testable through OpenSpec deltas, backend integration tests, and web-chat-view contracts.

**Non-Goals:**
- Do not preserve the old `systemId` / `subjectId` / `channelId` shared contract.
- Do not introduce a compatibility shim that keeps both source coordinate models alive.
- Do not redesign message-system storage again in this change; the room-isolated DB work remains the durable message law.
- Do not solve every future source family now; the registry must make future families possible without another kernel rewrite.

## Decisions

### 1. Attention source identity becomes `src`, owned by a namespace registry

The shared contract becomes a protocol address string such as room-scope `msg:<chatId>`, row-scope `msg:<chatId>/<messageId>`, or `tty:<terminalId>/<eventId>`. `packages/attention-system` will expose a registry that allows systems to register source namespaces. A namespace registration owns:

- `namespace`
- `parse(src)`
- `format(ref)`
- `key(ref)` for stable dedupe/invalidations
- optional `compare(left, right)` for cursor-like ordering
- optional `bucket(ref)` for notification grouping

`LoopBusPluginRuntime`, notification projection, navigation, and client/UI consumers use the registry instead of a kernel-owned `if (systemId === ...)` switch.

Why:
- The registry is the platform law; new systems become registrations, not new branches in shared code.
- `src` is the only cross-layer source identity that remains stable when a source family needs its own syntax or cursor rules.

Alternative considered:
- Keep the old tuple and add helper functions that translate it to strings.
- Rejected because the tuple would remain the real contract and the registry would become decoration.

### 2. Attention commits store protocol-native provenance

`AttentionCommitMeta` will carry `src` as the durable source identity, replacing the shared `systemId` / `subjectId` / `channelId` provenance tuple. Egress stays separate from provenance, as required by the existing attention graph law.

Legacy snapshots may still be read during migration, but newly persisted commits write the protocol-native shape only.

Why:
- Provenance should be the same contract everywhere the source is discussed.
- Keeping the old tuple in commits would force runtime publication and notifications to keep re-deriving the wrong abstraction.

Alternative considered:
- Add `src` while keeping the old tuple in parallel.
- Rejected because it preserves dual truth and guarantees future drift.

### 3. Notification projection becomes registry-driven and message-agnostic

Shared notification items will expose `src` and registry-derived bucket data instead of message-specific fields such as `messageId`, `messageSeq`, `chatId`, `terminalId`, or `sourceType`.

The shared snapshot shape becomes:

- `items[]` with `src`, `bucketKey`, and durable attention identifiers
- `unreadBySession`
- `unreadByBucket`

`consumeNotifications()` stops accepting `upToMessageId`. Instead it consumes by protocol-native source cursor, using the registry's bucket/comparison rules when the caller provides an `upToSrc`.

Why:
- Notification is an attention projection, not a message inbox.
- Bucket and ordering semantics differ by namespace; shared code should delegate those rules to registrations.

Alternative considered:
- Rename `messageId` to `src` but keep `unreadByChat` / `unreadByTerminal` and `upToMessageId`.
- Rejected because the public shape would still be message/terminal-specialized under a thinner disguise.

### 4. `web-chat-view` owns a view model, not the durable room record type

`web-chat-view` will stop aliasing `MessageRecord` directly as its shared message type. Instead it will expose a view-layer message model with:

- `viewKey: string`
- `messageId?: number`
- the existing transcript fields needed for rendering

Room-backed hosts map durable room rows to `viewKey = String(messageId)` and `messageId = <number>`. Tests and future optimistic hosts may use non-durable `viewKey` values without polluting the durable message contract.

Visible-message callbacks will likewise expose `viewKey` plus explicit numeric `messageId` when one exists.

Why:
- UI merge identity and durable room identity are different concepts and need different names.
- This keeps the shared chat package reusable without forcing every caller into room-message primary-key semantics.

Alternative considered:
- Keep string `messageId` in `web-chat-view` and add a second `persistedMessageId`.
- Rejected because the old misnamed field would still keep leaking into call sites and tests.

## Risks / Trade-offs

- [Risk] The registry touches server, client, and shared package boundaries at once. → Mitigation: land the registry first, then switch notification projection, then switch web-chat-view identity and repair tests in the same change.
- [Risk] Persisted attention snapshots may still contain legacy tuple metadata. → Mitigation: keep read-time migration for old snapshots, but only write the new `src` shape.
- [Risk] WebUI surfaces currently depend on `unreadByChat` / `unreadByTerminal`. → Mitigation: move those derivations to feature-level selectors or shared registry-aware helpers outside the kernel contract.
- [Risk] Existing tests and fixtures rely on string `messageId` in `web-chat-view`. → Mitigation: rewrite fixtures to use `viewKey`, and make durable numeric `messageId` explicit only where the scenario needs room truth.

## Migration Plan

1. Add the OpenSpec deltas for the new registry capability and the affected existing capabilities.
2. Introduce the shared registry and switch loop/source invalidation plus attention provenance to `src`.
3. Rewrite notification projection and consumption to use registry-derived `src` / bucket semantics.
4. Split `web-chat-view` into `viewKey` plus numeric `messageId`, then update hosts/tests.
5. Update runtime/client projections, targeted integration tests, and shared transcript contracts.

Rollback strategy:
- This is an intentional breaking migration. If verification fails, revert the whole change rather than reintroducing dual source contracts.

## Open Questions

- `task:` and future namespaces may want richer bucket presentation than a plain opaque `bucketKey`. The first pass only needs stable grouping; richer presentation can layer on top of the same registry without changing the core law.
