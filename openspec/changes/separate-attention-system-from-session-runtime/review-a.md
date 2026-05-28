## Review A

### Original User Law

- attentionSystem 非常纯粹，只提供一套面向熵值的信息管理办法
- 一切围绕 `AttentionItem` 和 `AttentionContext`
- 外部 systems 自己拥有自己的 timer / receipt / watch / follow-up 能力
- runtime 不应该把这些外部能力重新包装成 attentionSystem 自己的“功能”

### Alignment Conclusions

- 本 change 接受这条法则，并把它提升为 durable boundary：
  - AttentionSystem 只拥有 attention truth
  - external system 只把“需要注意的事实/义务”提交为 attention
  - 外部 timer/receipt/watch 仍然属于各自 system
- `followUpAfterMs` 的长期方向不是把 reminder 逻辑塞进 AttentionSystem，而是让 message-system 在 due 时提交一条 durable attention fact。
- `SessionRuntime` 的职责被明确收缩为：
  - cold-start 恢复
  - scheduling / orchestration
  - explicit effect production
  - 不是唯一 durable attention writer

### Scope Corrections

- 本 change 不解决 remote `AsyncContext + RPC` ownership propagation；那是下一层架构升级。
- 本 change 不解决 workspace-mounted systems 自身的 secret ownership / mount lifecycle；它只为那条路线建立 attention-independent foundation。
- 本 change 不把 queue / delivery ledger / watch registry 升级成 AttentionSystem 内建概念。
