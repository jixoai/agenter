## Context

Agenter 当前的 runtime law 是正确方向：

- 模型表面极小
- skills 走渐进展开
- direct tool 只保留 `root_workspace_list` 与 `root_workspace_bash`

问题不在“缺一个工具”，而在 Avatar 有时没有把这些 law 自然地转成行为。  
尤其是“天气 / 当前事实 / 外部世界信息”这类任务，如果继续靠 skill 文档里塞更长的 recipe，短期可能更容易过测试，但长期会直接违背当前架构哲学：

- skills 应该教 law，不应该教死板剧本
- system prompt 应该塑造人格和偏好，不应该把每个任务都拆成硬编码特判
- Avatar 的思维方式应该主要由 `AGENTER.mdx` 塑造

同时，real-provider 验证也需要一个更干净的载体。直接拿共享默认 Avatar 做这类测试，会把“共享人格漂移”和“本次验证目标”混在一起，因此这轮需要引入测试专用 Avatar。

## Goals / Non-Goals

**Goals**

- 让 `AGENTER.mdx` 明确塑造外部事实任务下的 shell-first、Linux 工程师式行为偏好。
- 让 runtime skill / shell reference 只客观说明 shell networking capability，而不退化成 recipe dump。
- 让 real-provider 外部事实测试使用测试专用 Avatar，并拥有自己的 `AGENTER.mdx`。
- 为外部事实型 real-provider 场景补足失败诊断，便于区分是 prompt law、skills law、provider latency 还是 runtime 行为的问题。

**Non-Goals**

- 这轮不重新扩大 direct model tools。
- 这轮不把具体天气查询命令写死进 prompt overview。
- 这轮不把 skills 重新变成 giant system guides。
- 这轮不重做整个 real-provider 测试框架；只收紧外部事实型场景。

## Decisions

### Decision: 外部事实任务的人格偏好进入 `AGENTER.mdx`

这轮把“你是 Linux 专家、终端能联网、遇到客观事实先验证再回复”的行为偏好，明确放进 `AGENTER.mdx`，而不是堆进 `skills.list` 或 `AGENTER_SYSTEM.mdx`。

理由：

- `AGENTER.mdx` 就是用来塑造人格和思维方式的真源。
- 这更符合“人格引导行为，而不是 workflow 绑死行为”的设计哲学。
- 这能让 Avatar 在天气之外的其它外部事实任务里也自然复用同一思维方式。

### Decision: runtime skills 只陈述 shell 能力，不提供固定 recipe

`agenter-runtime` 或 `shell-surface` reference 这类 runtime guidance 需要清楚说明：

- `root_workspace_bash` 是 one-shot Linux shell
- 它可以访问外部网络做客观验证
- 这种验证适合 current facts / external facts / objective checks

但它不应该内联一长串“天气怎么查”“新闻怎么查”的固定脚本。

理由：

- skills 负责把 law 说清楚，不负责替 Avatar 编死每一种查询配方。
- 继续往 skill overview 塞 recipe，会和当前的 progressive disclosure law 冲突。

### Decision: real-provider 外部事实测试使用测试专用 Avatar

real-provider 外部事实测试必须创建一个测试专用 Avatar，并为它挂载独立的 `AGENTER.mdx`。

具体上，测试 harness 需要支持：

- 创建或解析测试专用 Avatar identity
- 为该 Avatar 写入专用 prompt source
- 在结束后清理对应测试资产

理由：

- 避免把默认 Avatar 的共享人格状态污染到验证链路
- 避免不同 real-provider 场景互相拖累
- 便于对比某一版 `AGENTER.mdx` 是否真的改善了外部事实行为

### Decision: 外部事实验证仍然以 shell trace + 语义结果为核心

新的验证 contract 仍然坚持：

- 先有简短 acknowledgement
- 再出现 `root_workspace_bash` 的 tool trace
- 再有符合语义的最终回复
- 最后 attention 收敛

但会补更强的失败诊断，包括：

- room truth message timeline
- recent model calls / outcome
- tool trace
- 使用的是哪个测试 Avatar / prompt source

理由：

- 失败时需要先看到客观事实，而不是靠猜是“模型太笨”还是“prompt 不够长”。

## Risks / Trade-offs

- [Risk] `AGENTER.mdx` 改得太重，会把普通软件交付任务也带偏。  
  → Mitigation: 明确只塑造“外部事实任务的默认偏好”，不把 recipe 写死。

- [Risk] skill reference 如果表达不清，Avatar 仍然可能不知道 shell 可以联网。  
  → Mitigation: runtime skill 与 shell reference 明确陈述网络能力，但坚持 overview-first。

- [Risk] 测试专用 Avatar 会让 harness 复杂一些。  
  → Mitigation: 把它收成 test helper / fixture，不扩散到 runtime 正式路径。

- [Risk] 真实 provider 的外部网络波动仍然会带来偶发超时。  
  → Mitigation: 增强 diagnostics，并优先选择“客观可验证、但不依赖超长链路”的外部事实场景。

## Migration Plan

1. 先更新 delta specs，确认 prompt law、skill law、validation law 的边界。
2. 再实现测试专用 Avatar 与 `AGENTER.mdx` fixture。
3. 更新 runtime skill / prompt 内容。
4. 最后跑 real-provider 外部事实验证，并用 diagnostics 判断是否达到可推进状态。
