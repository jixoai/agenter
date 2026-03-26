## Context

`MessageControlPlane` now supports multi-channel chat, persistence, and websocket transport, but every operation still assumes a trusted in-process caller. That is enough for local experimentation, but it breaks the architectural goal of treating chat like terminal: a standalone service surface with channel-scoped access that can be consumed by WebUI now and native clients later.

The user already fixed the target boundary: `listChannels` and `createChannel` remain trusted bootstrap APIs, while subsequent channel-scoped work becomes tokenized. The design therefore needs to add channel access control without collapsing back into session-global trust or storing secrets inside runtime fact logs.

## Goals / Non-Goals

**Goals:**
- Introduce channel-scoped opaque tokens with `admin`, `member`, and `readonly` roles.
- Keep trusted bootstrap ergonomics for session-local channel discovery and creation.
- Require channel tokens for websocket transport and all channel-scoped read/write/admin APIs.
- Add metadata administration for title and participant management plus token issuance or revocation.
- Surface role-aware metadata editing in WebUI without persisting access secrets into `session.db` facts.

**Non-Goals:**
- No cross-workspace identity provider or external auth service in this change.
- No backward-compatibility layer for the pre-token channel APIs.
- No attempt to solve every future ChatApp plugin permission model beyond the core channel security boundary.

## Decisions

### 1. Bootstrap trust stays separate from channel trust
`listChannels` and `createChannel` remain trusted runtime-local APIs. They return an access projection for the caller: `accessRole`, `accessToken`, and a tokenized transport endpoint. Every later channel-scoped operation uses that projection rather than inheriting session-global trust.

Alternatives considered:
- Tokenize `listChannels` and `createChannel` too. Rejected because local runtime bootstrap still needs one privileged entry point and the user explicitly asked to keep it.
- Keep session trust and only guard transport. Rejected because it leaves snapshot/send/update APIs inconsistent and unsafe for future standalone clients.

### 2. Three explicit roles are enough for the first secure boundary
The role model stays at `admin`, `member`, and `readonly`.
- `readonly`: subscribe and page history.
- `member`: `readonly` plus send/reply/focus-like interaction.
- `admin`: `member` plus metadata mutation and token issuance or revocation.

The creator receives a bootstrap admin token from the trusted create path. That satisfies the user's “super-admin token” requirement without inventing a fourth role.

Alternatives considered:
- Add a separate super-admin role. Rejected because it complicates the initial matrix without a distinct behavior requirement.
- Use capability bitsets immediately. Rejected because YAGNI applies here; three roles already match the requested boundary.

### 3. Tokens are opaque, channel-scoped, and stored outside runtime facts
The message-system will persist hashed or opaque grant records in chat-channel storage and keep raw tokens only in trusted runtime/client memory. Session facts remain secret-free. The websocket endpoint becomes `ws://HOST:PORT/chat/$CHAT_ID?token=$TOKEN`, and the same token is accepted by snapshot/page/send/update admin APIs.

Alternatives considered:
- Session cookies or global bearer auth. Rejected because the chat service must stay independently embeddable.
- Storing raw tokens in session db for convenience. Rejected because it pollutes runtime fact history with secrets.

### 4. WebUI metadata editing is role-gated by the same access projection
The chat metadata disclosure surface will consume the access projection already returned by trusted bootstrap. Admins see edit and participant-management actions; non-admin roles see the same facts in read-only mode. This keeps the UI honest to the backend contract and avoids hidden privileged backdoors.

Alternatives considered:
- Let WebUI call trusted admin APIs directly. Rejected because it would bypass the security model we are trying to prove.

## Risks / Trade-offs

- [Token leakage through URLs or logs] -> Use opaque random tokens, avoid storing tokenized URLs in durable runtime facts, and keep transport URL generation localized to trusted bootstrap/client state.
- [Revocation races with live sockets] -> Revalidate token grants on websocket open and force-close sockets whose token is revoked or role-downgraded when the next privileged action occurs.
- [Cross-package churn] -> Keep the access projection shape minimal and thread it end-to-end through typed adapters to limit surface area.

## Migration Plan

1. Extend message-system storage and types with grant records, access projections, and admin operations.
2. Update websocket and control-plane APIs to require channel tokens.
3. Thread access projections through app-server and client-sdk bootstrap payloads.
4. Wire WebUI and `web-chat-view` to consume tokenized transport/admin flows.
5. Add tests for role gating, metadata updates, token revocation, and browser-level admin behavior.

## Open Questions

- Future token rotation UX can be refined later; this change only needs the core issue/revoke primitives and one admin-facing management path.
