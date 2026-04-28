## Why

`Heartbeat` 页面承担了 Avatar runtime 的最直接启动入口，但当前这条链路有两个薄弱点：

- 页面没有把 `start/stop` 动作的 pending / failure 事实显式投影出来
- 回归只覆盖了 Avatar Catalog 的 `Start avatar`，没有直接覆盖 `stopped Heartbeat 首屏 -> Start runtime`

这会导致一个很糟糕的操作体验：即便服务端启动链路客观可用，Heartbeat 页面一旦出现交互抖动、请求失败、或移动端 overflow 入口异常，操作者也只能感知到“无法启动 Avatar”，却看不到明确错误，也没有针对 Heartbeat 首屏 toggle 的 durable 验收。

## What Changes

- 给 Heartbeat runtime toolbar 的 `Start/Stop runtime` 控件补 action-level pending / error 投影。
- 当 runtime toggle 失败时，在 runtime route 内显示明确 notice，而不是静默掉失败。
- 增加一条真实浏览器回归：`stopped Heartbeat 首屏 -> Start runtime -> Running`，覆盖 desktop 与 mobile。

## Capabilities

### Modified Capabilities

- `workspace-runtime-shell`: runtime toolbar control 必须显式表达动作中的状态与失败事实

## Impact

- Affected systems: `@agenter/webui` runtime shell toolbar, Heartbeat route error surface, WebUI E2E runtime walkthrough
- No backend/runtime law change is intended; this is a route-surface stabilization and acceptance-gap closure
