## Why

当前 terminal font 的 durable profile 只有“声明字体”的能力，没有“terminal-view 自己确保字体资产存在并完成加载”的能力。最初的真实浏览器证据已经表明：terminal route 初始渲染和切换到 `JetBrains Mono` 之后，`document.fonts` 的状态与可见渲染不能单独证明 terminal-view 自己拥有字体资产。补做 terminal-owned loader 之后，真实浏览器现在已经能观察到 terminal-view 注入的字体样式 marker，以及对应的 hashed `woff2` 资源进入 `Resource Timing`。这意味着：

- 现有验收口径把 `@font-face`、`document.fonts`、真实资源请求、renderer settle 混为一谈；
- `terminal-view` 只能等待浏览器字体 ready，不能自持字体资源 law；
- 宿主 WebUI 的 `@fontsource` 注入成为隐式前提，破坏了 terminal-view 作为独立原子的完整性。

这会继续导致 `ghostty-web` / `xterm` / `wterm` 在切换 renderer、切换字体、fit 缩放和文本选择下出现不可预测的测量与重绘差异。

## What Changes

- 为 `@agenter/terminal-view` 增加自持的 terminal font asset / loader law。
- 将 terminal font families 收口为 `terminal-view` 自己导出的共享 catalog，由 loader 与设置面板共同消费，避免 WebUI 与 renderer 侧重复维护字体 truth。
- 将 `System Mono`、`SF Mono`、`JetBrains Mono`、`IBM Plex Mono`、`Cascadia Mono`、`Source Code Pro`、`Fira Code`、`Geist Mono` 纳入 terminal-view catalog；其中 optional webfonts 由 terminal-view 自己声明、去重注入、按需加载。
- 将“字体可用”拆成显式阶段：
  - font asset declared
  - font bytes requested / available
  - browser font ready
  - renderer settled
- 更新 renderer adapter 与 terminal-view contract，使字体切换必须经过 terminal-view 自己的 loader，再进入 renderer settle。
- 补充真实浏览器回归测试，使用 `Resource Timing API + document.fonts + terminal-view presentation-ready` 共同验证字体切换，而不是只看 CSS 或 DOM 表象。

## Capabilities

### New Capabilities
- `terminal-font-loading-law`: terminal-view 自持字体资产声明、去重加载、字体 settle 证据与 renderer 联动。

### Modified Capabilities
- `terminal-font-profile`: 字体 profile 不再只是 durable 样式声明；被 terminal-view font loader 解释为可执行的字体加载计划。
- `terminal-renderer-adapter`: renderer adapter 继续拥有 settle 责任，但不再假设宿主已完成字体资产准备。
- `terminal-view-component`: terminal-view 需要在 open / apply / rebuild renderer 前后显式执行字体资产加载与 readiness 验证。

## Impact

- `packages/terminal-view/package.json`
- `packages/terminal-view/src/terminal-renderer-profile.ts`
- `packages/terminal-view/src/terminal-font-catalog.ts`
- `packages/terminal-view/src/renderers/browser-terminal-font.ts`
- `packages/terminal-view/src/terminal-font-loader.ts`
- `packages/terminal-view/src/terminal-view-element.ts`
- `packages/terminal-view/src/index.ts`
- `packages/terminal-view/test/terminal-renderer-adapters.test.ts`
- `packages/terminal-view/test/*` new font loader coverage
- `packages/webui/src/lib/features/terminals/terminal-window-surface.svelte`
- `packages/webui/tests/e2e/system-surfaces.e2e.ts`
- `openspec/specs/terminal-font-profile/spec.md`
- `openspec/specs/terminal-renderer-adapter/spec.md`
- `openspec/specs/terminal-view-component/spec.md`
