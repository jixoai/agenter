# Icon Studio

`@agenter/icon-studio` 是独立的 Svelte 5 + Vite 8 项目，用来承载 icon composer 这类独立工具界面。

当前法则：

- `icon-studio` 是 icon composer 工具原子，不是 active operator Studio；它拥有自己的 `dev/build/preview` 生命周期。
- 工具内部可以复用 workspace 级共享 primitive，例如 `@agenter/svelte-components`，但不能依赖 `agenter-ext-studio` 的本地 feature、路由或主题文件。
- `assets/*` 这类离线构建脚本只允许依赖 `icon-studio` 的包级导出契约，不允许跨目录 import app route 层。
- `agenter-ext-studio` 与 `@agenter/icon-studio` 只在品牌与资产层保持一致，不共享运行时路由树。
- icon symbol source 采用分层法则：`assets/next/tokens/slots.json` 继续承载 curated presets，而 Lucide 全量图标通过 `assets/scripts` 生成本地 metadata + lazy chunk registry，再由 `icon-studio` 在前端按需加载。
- slot 外来图形采用两条正交控制轴：`preview` 负责把当前 fitted 结果可视化为小图与浏览 Dialog，`scale` 负责调节 Lucide / Custom SVG 的 fill 强度；二者都不能反向污染 curated preset 的 authored geometry。
