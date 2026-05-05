## Context

用户已经明确要求：

- `terminal-view` 自身要逻辑完备；
- 字体加载必须它自己做到；
- 如果与 WebUI 字体加载可能冲突，就提升为仓库内共享 law 或可靠第三方策略，而不是继续让宿主猜测；
- `Resource Timing API` 可以作为真实验收的一部分。

真实浏览器证据分成两个阶段：

1. 初始实现阶段，terminal route 初始加载时，`document.fonts` 与可见渲染不能证明 terminal-view 拥有字体资产；切换到 `JetBrains Mono` 后，`terminal-view.font.family` 会变化，但宿主级 `@font-face` 与浏览器缓存会混淆真正的作用源；
2. 引入 terminal-owned loader 之后，真实浏览器可观察到：
   - `style[data-terminal-font-asset="agenter-terminal-font-jetbrains-mono"]`
   - `document.fonts` 中 `JetBrains Mono` 的 `400/700` face 为 `loaded`
   - `Resource Timing` 中出现 terminal-view 注入后触发的 hashed `jetbrains-mono-*.woff2`
3. 因此当前 law 的关键不再是“有没有某个 family 名称”，而是“terminal-view 是否拥有字体资产的显式作用源，并让 renderer settle 能追溯到该作用源”。

## Physics Diagnosis

这不是“某个 renderer 参数没调好”的常规原子问题，而是底层法则缺失：

- durable font profile 只是样式投影，不是字体资产本体；
- browser font readiness 只是浏览器层投影，不是 terminal-view 的作用源；
- renderer settle 是可见效果，但当前没有清晰、可追溯的字体资产作用源。

因此需要把字体资产 law 下沉到 terminal-view 本身。

## Target Law

### 1. Terminal font asset registry

`terminal-view` 维护一个内建 registry / catalog，并将同一份声明导出给 host settings UI：

- `System Mono`
  - 不注入 webfont
  - 直接使用 literal system monospace stack
- `SF Mono`
  - 视为 system/local font option
  - 不要求 host-global CSS 导入
- `JetBrains Mono`
  - 注入 terminal-view 内建 `@font-face`
  - family 名称与 durable profile 中的 `JetBrains Mono` 保持一致
- `IBM Plex Mono`
  - 注入 terminal-view 内建 `@font-face`
- `Cascadia Mono`
  - 注入 terminal-view 内建 `@font-face`
- `Source Code Pro`
  - 注入 terminal-view 内建 `@font-face`
- `Fira Code`
  - 注入 terminal-view 内建 `@font-face`
- `Geist Mono`
  - 注入 terminal-view 内建 `@font-face`

catalog 只对 terminal-view / host 暴露声明式查询与稳定 option，不把 host 绑到资源路径。

### 2. Terminal-owned loader lifecycle

对每次 open / apply / rebuild：

1. 从 durable `font.family` 解析 primary family；
2. 若 registry 已知该 family：
   - 注入一次性 stylesheet / `FontFace`
   - 触发按需 load
   - 记录 load promise，按 family + weight + style 去重
3. 等待 browser font ready
4. 调用 adapter-local renderer settle

### 3. Evidence model

字体切换的验收不再只看一种信号，而是至少组合：

- terminal-view 已发起 font asset prepare
- browser font ready
- renderer settled
- 浏览器层资源证据可观察

`Resource Timing` 用于浏览器现场回归，不强制作为 runtime production API，但测试必须使用它验证真实字体资源路径。

### 4. Host boundary

WebUI 可以继续保留自己的应用字体加载，但：

- terminal-view 不再依赖 WebUI 的 `@fontsource` 才能正确工作；
- optional terminal webfont 的 authoritative source 仍然是 terminal-view 自己的 registry 与 injected marker；
- 去重依据是 terminal-view 自己的 registry key、signature 与 injected marker，而不是猜测宿主 CSS。
- WebUI dev host 不得把 `@agenter/terminal-view` 预构建进 `.vite/deps`；否则 workspace export 变更会被 stale prebundle 投影成 terminal route 的假 `500 Internal Error`。

## Design Decisions

### Decision A: terminal-view 内建 font registry and loader

推荐方案。优点：

- 满足 terminal-view 原子完整性；
- 作用源清晰，可追踪；
- 后续接入更多 renderer 或移动端 host 时，不再依赖 WebUI 的私有注入方式。

### Decision B: 继续依赖 WebUI 注入 + terminal-view 只 wait

拒绝。原因：

- host 特权未显式命名；
- 无法保证独立 embed 场景；
- 无法用 `Resource Timing` 自证 terminal-view 自身行为；
- 容易再次回归成“看起来加载了但其实没有”。

## Testing Strategy

### Unit

- 新增 terminal font registry / loader tests：
  - 解析 primary family
  - 首次注入
  - 重复调用去重
  - system stack 不注入 webfont
  - 新增 catalog family 可被 loader 正确解析

### Integration

- 更新 renderer adapter tests：
  - 字体加载从“仅 document.fonts.load”升级为“先 ensure asset，再 settle”
  - 验证 `ghostty-web` / `xterm` 均通过共享 loader law

### Browser E2E

- 在真实 terminal route 上：
  - 切换到 `JetBrains Mono`
  - 断言 `Resource Timing` 出现 terminal-view 自己注入的字体资源
  - 断言 `document.fonts` 对应 family 为 `loaded`
  - 断言 terminal-view 发出 settled fact

## Notes For Future Recovery

- 之所以默认倾向 `ghostty-web`，不是因为后端换核，而是前端 renderer 在 fit/scale 下的选择与性能、选择准确性更好。
- 后端仍然可以继续用 xterm/headless；前端 renderer 是独立 adapter 问题。
- 未来引入 `wterm` 时，字体 law 也必须走这层共享 loader，而不是为 `wterm` 再单独发明 host CSS 前置条件。
- 同理，未来若继续实验更多 renderer 或字体批次，优先扩展 catalog，不要回到 WebUI-local options duplication。
- 如果 terminal-view 再新增命名导出或调整 adapter surface，先检查 WebUI 的 `optimizeDeps` law，确认它仍然把 terminal-view 当源码而不是预构建依赖。
