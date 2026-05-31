## Context

当前 `packages/flutter-chat-view` 已经具备 room transport、asset upload、message merge、composer plugin 这些规则内核，但 `example` 仍然是一个 demo shell：连接配置面长期占据主画布，stage header 嵌在 package widget 内部，缺少产品级的 profile lifecycle、detail rail、conversation-first shell 与 adaptive navigation。用户已经明确拒绝把这作为“demo 交付”，同时也明确不希望污染 `packages/webui`。因此这次改动不是继续美化 example，而是把 Flutter Web 轨道升级为一个独立产品壳。

## Goals / Non-Goals

**Goals:**
- 把 `example` 从 demo operator surface 升级为产品壳。
- 明确 `packages/flutter-chat-view` 与 app shell 的正交边界。
- 提供本地持久化 connection profiles。
- 提供 desktop/compact 都成立的产品 IA。
- 提供对 selected message、participants、connection facts 的 detail surface。

**Non-Goals:**
- 不引入 `packages/webui` 或复用其 route shell。
- 不在本次 change 中完成 native packaging。
- 不在本次 change 中实现最终形态的 anchored virtualization runtime。
- 不把 app-shell 专属 profile persistence 混入 `packages/flutter-chat-view` core package。

## Decisions

### Decision: 维持 `kernel / shell` 二分

`packages/flutter-chat-view` 继续持有 transport、message model、composer plugin、stage-level transcript/composer law；`example` 负责 app-level navigation、profile persistence、app IA。这样 Web 首发不会把 app-shell 状态污染到可移植 package 中。

Alternatives considered:
- 继续把 app-level 状态堆进 `FlutterChatView`：会让 package 退化成产品页面，而不是可移植 stage primitive。
- 把 profile persistence 放进 controller：会把 host-specific lifecycle 混进 transport kernel。

### Decision: 连接 profile 作为 app-shell 原子

产品壳使用本地持久化 connection profiles，而不是每次重新输入 `url + token`。Profile 属于 operator app shell 的事实，不属于 room transport contract，因此它被建模为 `example` 内的独立 controller/store。

Alternatives considered:
- 继续只靠 query parameters：适合 demo，不适合产品使用。
- 把 profile schema 写进 `packages/flutter-chat-view`：会让 package 承担不属于 transport/stage 的宿主职责。

### Decision: 聊天主舞台采用 conversation-first shell

wide 模式使用 `profile rail + chat stage + detail rail`；compact 模式通过自适应导航保留相同能力路径。配置工作流退到 secondary sheet/drawer，主舞台只承载 conversation-first experience。

Alternatives considered:
- 保留“左边配置、右边聊天”的 demo 布局：会让配置工作流长期挤占产品主舞台。
- 只做一个全屏聊天页：会失去 profile 和 detail 的产品层级。

### Decision: package stage 去页面化

package 内部的 `FlutterChatView` 不再强占 app-level header，而是向 host shell 暴露更纯粹的 chat stage。产品壳负责 route title、status summary、secondary actions；package 负责 transcript/composer interaction。

Alternatives considered:
- 保留 package 自带 header 并在外层再套一层产品 header：会造成重复 chrome。

### Decision: transcript affordance 先做 app semantics，再做完整 scroll runtime

本轮先补足时间分隔、message selection、return-to-latest、selected-detail projection 等产品级语义；anchored virtualization 继续作为下一次 scroll-runtime 范式升级处理。这样可以先把 IA 和 interaction shell 建立起来，而不是被底层 scroll runtime 卡死。

## Risks / Trade-offs

- [Risk] 仍未实现最终 anchored virtual scroll runtime。 → Mitigation: 本轮先把 transcript affordance 和 host composition law 抽象正确，为下一次 scroll primitive 升级留接口。
- [Risk] app-shell 持久化目前是 local-only。 → Mitigation: 将 store 抽象为接口，后续可以替换成更强的 host persistence。
- [Risk] compact navigation 与 desktop rail 需要双套壳层逻辑。 → Mitigation: 把共享状态集中在 app-shell controller，UI 只做 adaptive projection。

## Migration Plan

1. 新建 `flutter-chat-view-app-shell` OpenSpec change。
2. 在 `example` 内引入 app-shell controller、profile store 和响应式壳层。
3. 调整 `packages/flutter-chat-view`，让 chat stage 能被 host shell 组合。
4. 添加/更新 widget tests，验证 compact 与 desktop shell。
5. 重新跑 Flutter analyze/test 并同步 durable docs/specs。

## Open Questions

- 下一轮 anchored scroll runtime 是否直接进入 package core，还是先以 host shell abstraction 过渡。
- profile token 是否需要在 phase 2 进入更安全的存储策略。
