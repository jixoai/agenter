## 1. Law and Review Alignment

- [x] 1.1 Review this breaking proposal against the user law: room management is shared room durability, while message-system is a superadmin-bound authority/runtime with stable `systemId`.
- [x] 1.2 Record Review A conclusions, especially the ownership split between room membership truth, room `superKey` control, and message-system Contact authority/proofs.
- [x] 1.3 Record the current `web-chat-view` repo truth and the candidate Framework7 worktree merge plan before Studio room-surface implementation continues.
- [x] 1.4 Update durable repo/package specs so `message-system` no longer implies private room ownership as a long-term law.

## 2. BDD Contract First

- [x] 2.1 Add failing BDD for a default local singleton message-system with a stable `systemId` bound 1:1 to the current superadmin.
- [x] 2.2 Add failing BDD proving one room-management backend can persist transcript truth from multiple local message-system instances, each with distinct `systemId` provenance.
- [x] 2.3 Add failing BDD proving one message-system instance can serve multiple registered Contacts/keys against the same room-management backend.
- [x] 2.4 Add failing BDD proving room `superKey` can read/manage a room without becoming a sending participant seat.
- [x] 2.5 Review the BDD scenarios with the user as Review B before broad implementation proceeds.

## 3. Room Management Extraction

- [x] 3.1 Introduce the room-management durable boundary and explicit room-management control-plane contract.
- [x] 3.2 Reset the local room/message database schema instead of preserving backward compatibility with the old ownership model.
- [x] 3.3 Persist source provenance by `systemId` for room transcript rows and room-side lifecycle/admin events.
- [x] 3.4 Persist room `superKey` as first-class room control truth independent from room seats.
- [x] 3.5 Route archive/delete room mutations through room-management authority so those actions are owned by room `superKey` domain truth rather than by implicit participant/admin shortcuts.

## 4. Message-System Instance Identity

- [x] 4.1 Introduce explicit message-system instance identity with one default local singleton bound to the current superadmin.
- [x] 4.2 Introduce local keyed creation for additional message-system instances without turning every Contact into its own system.
- [x] 4.3 Preserve message-system Contact/source-subscription responsibilities while rewiring room operations through room management.
- [x] 4.4 Set the current version's default `systemId` to the superadmin address and document that law explicitly.

## 5. Runtime / Surface Realignment

- [x] 5.1 Update app-server/runtime integration so room operations talk to room management through the new contract instead of assuming one private local message database.
- [x] 5.2 Audit message-system and runtime inspection surfaces to expose `systemId`, `superKey`, and room-management ownership truthfully.
- [x] 5.3 Audit Studio room/message surfaces so they stop implying one implicit local message-system owns every room and stop collapsing room control into participant identity.
- [x] 5.4 Redesign room detail/manage flows so room control actions work under `superKey` even when no sending seat is selected.
- [x] 5.5 Keep Studio domain/source metadata low-emphasis and outside the primary transcript focus path.
- [x] 5.6 Re-evaluate whether Studio should embed `web-chat-view` through direct host, custom-element host, or iframe boundary before landing large chat-surface rewrites.
- [x] 5.7 Land a minimal Framework7-capable `web-chat-view` baseline from the dedicated review-shell worktree, or port its equivalent committed baseline, before broad Studio message-shell rewrites continue.
- [x] 5.8 Keep uncommitted review-shell experiment changes out of the merge path until they are either committed cleanly or intentionally reimplemented in this worktree.

## 6. RPC-Ready Contract Hardening

- [x] 6.1 Define the room-management RPC/pub-sub contract in durable specs and code comments without implementing the full remote stack yet.
- [x] 6.2 Add focused tests proving the local contract is transport-shaped and does not depend on in-process hidden state.
- [x] 6.3 Record explicit deferrals for future remote authentication/context propagation work so local-first implementation does not grow bridge glue again.
- [x] 6.4 Review frontend/operator flows with the user before remote implementation starts, so local UX does not encode the wrong authority model.

## 7. Final Verification and Realignment

- [x] 7.1 Run targeted BDD for `message-system`, affected runtime integration, and Studio/message surfaces.
- [x] 7.2 Run broader regression verification for room catalogs, room transcript operations, and follow-up/archived-room paths affected by the reset.
- [x] 7.3 Re-read the original user goal and perform a final deviation audit before archive, documenting any intentional debt that remains.
- [x] 7.4 Produce the final deviation list in plain language before archive.
- [x] 7.5 Produce the future task list in plain language before archive.

## Review Notes

- Review B input: the first failing red test now stops at `message-system instance identity contract missing getSystemIdentity()`. This is the correct first missing law: without explicit `systemId`, the later requirements for multi-system provenance and room `superKey` authority have no stable anchor.
- Review B alignment: the user accepted the BDD direction with one required correction: message-system must say it serves multiple **Contacts**, not multiple contacts. Contact is the canonical message-system term shared with contact management.
- Review B alignment: this is a breaking update. Do not preserve old `contact_*` public API/table vocabulary as compatibility glue.
- Review B input: the BDD suite intentionally covers four app-law claims before broad implementation: default singleton `systemId = superadmin address`, shared room-management backend with multiple `systemId`s, one system serving multiple Contacts, and `superKey` read/manage without send membership.

## Multi-Turn Self Review

- Review A: established the room-management/message-system boundary and rejected hidden participant shortcuts.
- Review B: corrected the service-object vocabulary from contact to Contact before implementation, while keeping `PrincipalId` as the cryptographic identity primitive and participant as the room-seat fact.
- Review C: green BDD confirmed the local-first law: default `systemId = superadmin address`, one room-management backend accepts multiple `systemId`s, one message-system serves multiple Contacts, and `superKey` can read/manage without becoming a sender.
- Review C deviation fixed: client-sdk room catalog hydrate intentionally requests `{ includeArchived: true }`; the stale test expectation was corrected so archived-room UX remains backed by one complete catalog.
- Review C deviation fixed: app-server message contact routes still exposed `invitedActorId`; the public message-domain field is now `invitedContactId`.
- Review C deviation fixed: durable specs still mentioned `actor/contact` and `readActorIds` / `unreadActorIds` for message-system room truth; they now use Contact terminology.
- Review C deviation fixed: long-lived `openspec/specs/*` message read and people-shell specs still preserved old read/contact field names; they now use `readContactIds` / `unreadContactIds` and `ownerContactId` / `remoteContactId`.
- Review C intentional debt: the room-management boundary is implemented as a separable local contract inside `@agenter/message-system`, not as a new package or network service yet.
- Review C intentional debt: app-server still owns the remote contact-search/contact-request HTTP bridge, and auth catalog projections still expose `actorId` because that is auth-system terminology, not message-system Contact truth.
- Review C intentional debt: `packages/flutter-chat-view` still models the older chat transport field names. It is outside the current TypeScript verification surface and needs its own explicit migration pass.

## Plain-Language Deviation List

- 最初容易把 room control 和 participant seat 混在一起。现在 `superKey` 只管房间控制，不能自动发消息。
- 最初容易把一个 Contact 当成一个 message-system。现在一个 message-system 有一个 `systemId`，可以服务多个 Contacts。
- 实现中一度把 message-domain 的联系人字段继续叫 actor。已清理 `message-system`、active change、TRPC invite participant、root SPEC 中会误导后续开发的旧词。
- 长期 OpenSpec specs 里也残留了旧的 read/contact 字段名。已同步清理，避免后续按旧规格继续开发。
- client-sdk 的旧测试还以为全局房间列表只拉 active。现在完整 catalog 要能支撑 active/archive 两个入口，所以 hydrate 明确包含 archived。
- notification 测试里混入了 runtime skill snapshot 的旧通知。现在测试先清空无关通知，只验证本场景的 persisted message push。
- 没有把 room-management 立刻拆成独立 npm package 或 RPC 服务。这是有意控制范围：先把本地 contract 和 durable law 立住。
- Flutter 版 chat view 还保留旧字段名。这轮没有静默迁移跨语言产品面，后续要单独做一轮 BDD/契约迁移。

## Plain-Language Future Task List

- 下一轮把 room-management 从 `@agenter/message-system` 代码内进一步抽出成独立模块/package，减少物理耦合。
- 为 room-management 增加真正的 RPC/pub-sub 服务层，让远程 message-system 走同一套 contract，而不是 app-server 临时 HTTP bridge。
- 为多 message-system 实例增加持久化 registry 和密钥管理 UI；当前本地实例身份已经可显式传入，但还没有完整 operator 管理面。
- 为 room admin/lifecycle 事件增加更细的 event ledger；当前已持久化 room 创建来源和 transcript message 来源，后续应把 archive/delete/grant 这类 admin 事件也做成可查询事实流。
- 继续收口 web-chat-view 示例里的 `viewerActorId` 等旧 UI 词汇；如果保留，也必须明确它属于 auth/presentation 投影，不属于 message-system Contact law。
- 迁移 `packages/flutter-chat-view` 的 transport/model/UI 字段到 Contact 术语，并补跨语言 contract 测试，避免 TypeScript 侧已经破坏性更新但 Flutter 侧仍按旧协议解析。
- Studio 需要继续做真实浏览器截图验收，验证 superadmin metadata 低强调、archived room 入口、control-only no-seat 状态在 desktop/mobile 都稳定。
