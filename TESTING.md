# Testing Scope (High-Value First)

本文件定义仓库测试边界，避免回退到低信号 smoke 测试。

## Method

- 默认方法：BDD-first（Feature / Scenario / Given-When-Then）。
- 执行手段：TDD（Red-Green-Refactor）。
- 判定标准：只保留“能证明关键行为”的测试。

## Package Coverage

- `@agenter/app-server`
  - e2e：daemon HTTP/WS/instance lifecycle 与 web root。
  - integration：loop bus phase、protocol parse、registry durability。
- `@agenter/cli`
  - e2e：`agenter daemon` + `agenter doctor`，`agenter web`。
  - 不保留仅“导出存在”的 smoke。
- `@agenter/tui`
  - unit/integration：ws 消息解析契约（snapshot/updated/deleted/chat）。
  - 不做脆弱的渲染细节断言。
- `@agenter/webui`
  - contract：html shell 包含 viewport/ws/bootstrap 关键标记。
- `@agenter/terminal`
  - core/integration：日志链、dirty slice、输入解析、git-log、渲染行为。
- `@agenter/settings`
  - contract：settings source merge、resource loader 协议与别名解析。
- `@agenter/mdx2md`
  - security/transform：标签策略、表达式策略、自定义 transform。
- `@agenter/demo`
  - composition：runtime config、loop bus、prompt store、dispatcher。

## Anti-Patterns

- 仅断言 `typeof exportedFn === "function"` 的 smoke。
- 对内部实现细节做强耦合断言（私有字段/瞬时顺序）。
- 高耗时但低信号的重复链路测试。

## CI Baseline

```bash
bun run typecheck
bun run test
```

