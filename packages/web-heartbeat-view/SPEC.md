# `@agenter/web-heartbeat-view` SPEC

This document records durable package-level law for the Heartbeat presentation atom.

## 1. Package Role

`@agenter/web-heartbeat-view` owns the reusable Heartbeat runtime observation surface.

It owns:

- grouped Heartbeat presentation over existing runtime-store facts
- paged Heartbeat record presentation over existing runtime-store facts
- parser/materialization helpers for grouped `before-call`, `call`, `compact`, and `before-call-pending` records
- structured rendering for text, thinking, JSON/config facts, tool calls/results, compact cards, and footer status
- explicit `readonly | configable` capability presentation
- host-neutral `AgenterHeartbeatConnection` types

It does not own:

- backend Heartbeat truth or new backend endpoints
- Studio route/controller state
- example app routing/bootstrap
- authentication or authorization policy

## 2. Truth Boundary

Heartbeat source truth remains runtime/session DB facts. For list presentation, the package consumes the `heartbeat_record`
materialized record projection supplied by `@agenter/client-sdk`.

The package must not rebuild Heartbeat truth from raw chat, raw `request_aux`, raw `heartbeat_part`, or model-call histories in the browser. It must render record pages in the order returned by the runtime API and may only add presentation items such as date dividers.

Repairing damaged session DB projections is a backend/session-system maintenance operation. This package must not infer, hide, or synthesize missing source facts.

## 3. Capability Boundary

`readonly` is a frontend presentation mode that keeps the surface clean by hiding compact/config write controls.

`configable` may expose bottom-statusbar compact/config actions, but those actions must call explicit host callbacks.

Transport isolation belongs to authentication and authorization, not to the package's presentation mode.

## 4. Host Boundary

The package must not import `apps/studio`. Studio may later import this package through a thin adapter after standalone example acceptance.

Framework7 page wrappers are optional host conveniences; the core `HeartbeatView` remains host-neutral.

## 5. Verification Contract

High-value package verification requires:

- `bun run --filter '@agenter/web-heartbeat-view' typecheck`
- `bun run --filter '@agenter/web-heartbeat-view' test`

Standalone user acceptance belongs to `packages/web-heartbeat-view/example`.
