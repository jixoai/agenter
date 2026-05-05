## Context

`messageSystem` already owns the durable room catalog, actor-scoped grants, room transport, and unread state. It also already persists enough remote room authority facts to let one avatar connect to a room that lives on another agenter instance. What it still lacks is the durable "people layer" that sits before room membership: source subscriptions, durable contacts, and durable contact requests.

Today the runtime's reachable-participant directory is only a projection from currently visible room labels. That is not durable identity truth, it does not work before a shared room already exists, and it makes cross-instance testing unnatural because two actors must be manually placed into one room before message collaboration starts.

This change introduces the contact layer inside `messageSystem` rather than as a new peer system. The contact layer is not a separate ontology from messaging; it is the durable pre-room boundary that lets messaging become natural across local and remote sources.

## Goals / Non-Goals

**Goals:**
- Add actor-private source subscriptions as the durable truth for remote `messageSystem` discovery.
- Add durable actor-private contacts and contact-request inbox records.
- Reuse the remote source's auth actor catalog for actor search instead of inventing a second people directory.
- Allow `accept-contact` to optionally bootstrap a paired direct-room conversation with the first synced message.
- Keep direct rooms strict 1:1 and force third-party invites to branch into new public rooms.
- Make cross-instance tests follow a contact-first flow instead of requiring pre-created shared rooms.

**Non-Goals:**
- No standalone `contactSystem`.
- No principal-level merge across sources in v1.
- No attempt to make `messageSystem` itself perform network auth or own browser/operator login flows.
- No large WebUI feature buildout in this slice beyond the backend and runtime projections needed for testing and future surfaces.

## Decisions

### 1. Contact truth stays inside `messageSystem`

`messageSystem` gains three new durable actor-private record families:
- source subscriptions
- contacts
- contact requests

This keeps the "people before rooms" facts adjacent to the room system they eventually feed, and avoids creating a second system that would need to mirror actor ids, source ids, request lifecycle, and direct-room bootstrap state.

Alternative considered:
- A separate `contactSystem`
  - Rejected because it would immediately require cross-system joins for search, request lifecycle, direct-room creation, and runtime directory projection.

### 2. Remote search uses the remote auth actor catalog, not a second discoverable contact directory

Each source subscription points at a remote agenter endpoint and optional bearer token. Search calls are proxied by app-server to the remote instance's existing auth actor catalog route. The catalog remains the source of public actor identity; the local contact record remains the source of "I know this actor from this source".

Alternative considered:
- Add a second remote discoverable-contacts directory inside messageSystem
  - Rejected because identity discovery is already solved by auth actor catalog, and duplicating it would create drift between profile truth and contact truth.

### 3. Network access stays in app-server, not in `messageSystem`

`messageSystem` only stores durable source metadata and contact truth. `app-server` is responsible for using that source metadata to call remote `/trpc` endpoints with the stored bearer token. This keeps `messageSystem` transport-agnostic while still making cross-instance contact flows executable.

Alternative considered:
- Let `messageSystem` call remote endpoints directly
  - Rejected because it would couple the durable control plane to HTTP, auth headers, and remote caller transport details.

### 4. Contact acceptance is orthogonal to direct-room bootstrap

Accepting a contact request creates the contact relationship only. `accept-contact --firstChat` is the explicit shortcut that additionally creates paired direct rooms and sends the first synced message.

Alternative considered:
- Always create a room when a contact is accepted
  - Rejected because it violates the user's desired orthogonality and would make contact acceptance carry hidden side effects.

### 5. Direct room stays `kind: "room"` with metadata law

We do not introduce a second channel kind. Instead room metadata gains:
- `roomMode: "direct" | "public"`
- optional remote pairing metadata for synced direct-room bootstrap

Direct rooms are enforced as strict 1:1 rooms. Any operation that tries to invite a third actor from a direct room must create a new public room instead of mutating the existing room.

Alternative considered:
- Add a second channel kind for direct conversations
  - Rejected because the room transport, message durability, grants, and room lifecycle law already exist and only need metadata-level branching.

### 6. Runtime directory becomes contact-aware with room-label fallback

Runtime tooling keeps the current visible-room summary surface, but reachable participants become contact-aware. Durable contacts are projected first; the existing label-only room directory becomes fallback only when no durable contact facts exist.

Alternative considered:
- Leave runtime directory as label-only for now
  - Rejected because it would keep teaching the model that room labels are people truth.

## Risks / Trade-offs

- [Stored remote bearer tokens increase private secret surface] → Keep subscriptions actor-private, avoid projecting tokens back to shared UI/runtime surfaces, and validate missing/invalid tokens explicitly.
- [Cross-instance sync can drift if paired direct-room metadata becomes inconsistent] → Persist pairing metadata on both rooms and keep the first slice limited to append-only direct-room message sync.
- [Adding durable tables to messageSystem increases schema complexity] → Keep the new tables actor-private, keyed narrowly, and independent from room transcript tables.
- [Direct-room/public-room branching may surprise existing generic room flows] → Encode `roomMode` explicitly in metadata and add tests that prove third-party invite creates a new public room.
- [Remote source availability is unstable] → Treat transport failures and credential failures as explicit errors on search/request actions instead of mutating local contact truth optimistically.
