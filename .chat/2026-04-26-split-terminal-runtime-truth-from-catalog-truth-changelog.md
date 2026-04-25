# 大白话 Changelog: split-terminal-runtime-truth-from-catalog-truth

## 一句话

这次不是在修一个“terminal 页面显示错了”的小 bug，而是把 terminal 的底层真相重新分层了。以前系统把“创建时的配置”“现在终端真实跑到哪里了”“PTY 现在活着还是死了”“当前 websocket 能不能连”全塞在一个扁平对象里，所以前后端和页面都只能靠猜。现在这几层被拆开了。

## 内核怎么变了

- `terminal-system` 现在把 terminal 真相拆成四层：
  - 启动配置真相：`launchCwd`、`configuredTitle`
  - 运行时观察真相：`currentPath`、`currentTitle`
  - 生命周期真相：`processPhase`、`lastStopReason`、`lastExitCode`、`lastExitSignal`、`lastStoppedAt`
  - 运行时活动真相：`status`、`snapshot`、`seq`、`transportUrl`
- `kill` 不再一把梭。现在明确分成三种动作：
  - `bootstrap PTY`：把 terminal 启起来
  - `stop PTY`：只停 PTY，不删 terminal 目录项
  - `delete terminal`：真的删掉 terminal
- 以前很多“读一眼就偷偷帮你启动 terminal”的坏行为被去掉了：
  - 打开 transport
  - 做 read / snapshot
  - 做 write / input
  - 这些现在都不会再偷偷 bootstrap
- `transportUrl` 不再是假装“terminal 一直都有一个地址”。现在只有 `running` 的 PTY 才有 live transport。

## title 和路径怎么变了

- terminal title 不再只看创建时配的 title。
- 如果底层有 xterm / xterm-headless，就优先用 `onTitleChange`。
- 如果没有，就从终端输出里解析 OSC。
- `OSC 7` 现在会被解析成 `currentPath`，所以 toolbar second line 不会再硬显示一个过期的 launch cwd。

## app-server 怎么变了

- `app-server` 不再自己发明 terminal 真相，它只负责把 `terminal-system` 的 authoritative projection 发出来。
- 全局 terminal API 现在有明确的：
  - `globalBootstrap`
  - `globalStop`
  - `deleteGlobalTerminal`
- runtime tool 里的 `terminalKill` 语义也被修正了，现在是“停 PTY”，不是“顺便把 terminal 删了”。

## client-sdk 怎么变了

- store 合并逻辑现在能保住这些新字段：
  - `launchCwd`
  - `configuredTitle`
  - `currentTitle`
  - `currentPath`
  - `processPhase`
  - `lastStopReason`
  - `transportUrl`
- 尤其修掉了一个很关键的问题：
  - `transportUrl` 现在可以被明确清空
  - 不会再因为 merge 逻辑太“聪明”，把已经 stopped 的 terminal 误保留成还可连

## WebUI 怎么变了

- terminal 页面不再从旧的 `cwd/title/running/status` 猜状态，而是统一走共享 helper。
- toolbar 的主标题现在是：
  - terminal instance name，也就是 `configuredTitle ?? terminalId`
- second line 现在是：
  - 运行中且有 `currentPath` 就显示 `currentPath`
  - 没有运行时路径时，不再假装 launch cwd 就是当前路径
- terminal window 自己的 titlebar 继续吃 PTY 观察标题：
  - `currentTitle ?? configuredTitle ?? terminalId`
  - 也就是说，窗口里可以跟着 shell / OSC title 变化，但上层 tab 和 page-toolbar 不会被带跑
- stopped terminal 现在会留在当前路由里，不会因为 PTY 停了就像“terminal 消失”一样。
- write/read 面板在 stopped 时会禁用，并且明确提示你先 `Bootstrap PTY`。
- `Delete terminal` 现在是单独的破坏性动作，不再和 stop 混在一起。

## 规格和测试怎么变了

- OpenSpec 已经补齐：
  - proposal
  - design
  - 5 份 delta specs
  - tasks
- 验证做了分层：
  - `terminal-system` BDD
  - `app-server` targeted tests
  - `client-sdk` store tests
  - `webui` unit + Storybook DOM tests
  - 其中新增了一条回归：锁住“tab/toolbar 用 instance name，window 才用 PTY title”
  - real AI loopbus walkthrough
  - real AI room terminal walkthrough
  - real browser desktop/mobile surface evidence

## 对以后有什么价值

- 以后再接 terminal 页面、runtime 页面、attention 上下文、甚至别的 system，不需要再去猜 terminal 到底“现在是什么状态”。
- 只要消费这套投影，就能知道：
  - 这是创建时的配置
  - 这是现在观察到的真实 title/path
  - 这是 PTY 生命周期
  - 这是当前 live transport
- 这意味着 terminal law 终于从“页面补丁集合”变成了“内核规则”，以后新增 system 时心智负担会小很多。
