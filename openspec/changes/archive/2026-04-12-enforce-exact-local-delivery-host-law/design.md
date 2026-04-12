## Context

skills+CLI 架构下，LoopBus 本身并不会替 AI 解释“到底什么叫 URL 真的交付成功”。这个 law 必须由 runtime skills 提前说清楚，否则模型就会自己发明近似等价：

- `127.0.0.1` 不通，但 `[::1]` 通了
- `localhost` 能打开，就当成 `127.0.0.1` 也成立
- host 没对上，只要页面内容对了就先发 URL

这些都违反了单一信源。对外承诺的 URL 是一个完整事实：

- scheme
- host
- port
- path

只要其中任一部分不一致，就不是同一个交付结果。

## Goals / Non-Goals

**Goals:**
- 把 exact URL host law 明确写进 runtime skills
- 让模型知道 alternate host success 不是成功，只是偏差证据
- 给常见本地服务绑定提供直接例子，降低“默认 bind localhost”这类自然漂移
- 用真实 AI 回归确认它不再拿 `[::1]` 冒充 `127.0.0.1`

**Non-Goals:**
- 不改 runtime-local API
- 不在平台层硬编码拦截所有 room URL 消息
- 不引入新的 direct tools 或强制 wrapper binary

## Decisions

### 1. Host 是契约的一部分，不是可替换实现细节

当 room 里承诺 `http://127.0.0.1:49893/` 时：

- `http://localhost:49893/` 不是成功
- `http://[::1]:49893/` 不是成功
- `http://127.0.0.1:3000/` 也不是成功

即使 alternate host/port 能返回 200，也只能说明“当前服务配置偏了”，不能成为 room announcement 的依据。

### 2. 反例比抽象提醒更重要

真实模型已经证明，单说“verify exact URL”还不够。它会自己加 `|| curl [::1]` 这种 fallback。所以这次要把反例直接写进 skills：

- wrong: promised `127.0.0.1` but verified `[::1]`
- right: exact promised URL must return success, otherwise rebind/restart

### 3. 对常见本地服务给出显式 bind 例子

以 `python3 -m http.server` 为例，如果契约指定 `127.0.0.1`，skill 必须直接给出：

`python3 -m http.server <port> --bind 127.0.0.1`

而不是只给泛化的 `python3 -m http.server <port>`。这样 AI 在生成命令时会更稳定地遵守 host law。

## Risks / Trade-offs

- [Risk] skills 变得更长
  → Mitigation: 只补高价值 host law 和一个反例，不加大段教程

- [Risk] 某些真实环境里 `localhost` 比 `127.0.0.1` 更常见
  → Mitigation: 仍然允许用户显式要求 `localhost`；本次只是强调“承诺哪个，就验证哪个”

## Migration Plan

1. 补 delta spec，明确 exact host binding 属于 delivery truth
2. 更新 `runtime-skills.ts` 中 runtime / terminal / message 相关 law
3. 更新技能测试
4. 重跑真实 AI room-terminal 交付验证

回滚策略：

- 如果仅靠 skills 强化仍不足以稳定约束真实模型，再讨论新的 shell helper 或更强的 runtime-side contract enforcement
