# UI Package

`@agenter/ui` 承载可复用的 Svelte UI 工具与独立可挂载的界面原子。

当前法则：

- 包级工具不允许依赖 `@agenter/webui` 的本地 feature 或本地组件封装。
- 可复用工具应直接依赖 package-level contract 与共享 layout primitive。
- 应用层只负责路由挂载、上下文注入与站点级主题，不拥有工具内部实现。
