# @agenter/message-system SPEC

> 本文档只记录 `@agenter/message-system` 长期职责、边界与公共契约。

## 1. Boundary

- `message-system` 是 superadmin-bound messaging authority/runtime；默认本地实例与当前 superadmin 1:1 绑定，并以 superadmin address 作为当前版本的默认 `systemId`。
- `message-system` 负责 contact registration / contact use, contacts, source subscriptions, signatures/proofs, managed-seat invitation grammar, and the client/runtime orchestration needed to act through room management.
- `message-system` 不再作为概念上的 room durability owner。Room catalog, transcript truth, room revision, transcript revision, read/unread truth, room lifecycle, persisted membership, and pub/sub durability belong to the `room-management` boundary.
- 当前实现可以暂时把 local room-management code 与 message-system code 放在同一个 package 内，但 public law 必须保持两条边界可分离、可测试、可被未来 RPC/pub-sub 暴露。

## 2. Room Management Contract

- Every room has explicit control truth through `superKey`; `superKey` is not a participant seat.
- `superKey` can read transcript truth and manage room configuration, membership, archive, and delete.
- `superKey` cannot send chat messages unless it also receives a normal participant seat.
- Room transcript rows and room-side lifecycle/admin events must persist source provenance by `systemId`.
- One room-management backend must be able to persist transcript truth from multiple message-system instances.
- Room websocket transport must re-publish mutated message rows when durable read/unread truth changes so connected clients can reconcile row-level state without forcing a fresh snapshot.

## 3. Message-System Instance Identity

- Every message-system instance has one stable `systemId`.
- One message-system instance may serve multiple registered contacts/keys; contact identity must not collapse into `systemId`.
- Additional local message-system instances must be created from explicit keys and must not overwrite the default local singleton identity.

## 4. Remote Direction

- Remote message-system participation must be built by exposing the room-management contract over RPC/pub-sub.
- Local-first APIs must stay transport-shaped: they require explicit room-management inputs and identity/proof inputs, not hidden in-process private room ownership.
- Do not add remote-only exception fields or bridge glue that re-couples room truth to a specific message-system runtime.
