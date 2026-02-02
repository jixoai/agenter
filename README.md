# Agenter

基于记忆的 AI 助手。使用 **队列工作流** 处理多 Tab 对话。

## 架构

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   TUI       │◄──►│  WebSocket  │◄──►│  API Server │
│  (React)    │    │   (ws://)   │    │  (Bun.serve)│
└─────────────┘    └─────────────┘    └─────────────┘
                                              │
                    ┌─────────────┐    ┌─────┴────────┐
                    │ Rememberer  │◄──►│    LLM       │
                    │(recall+meta)│    │ (@tanstack)  │
                    └─────────────┘    └──────────────┘
```

## 工作流程

1. **输入** - 在 Tab 输入消息
2. **Recall** - 检索相关记忆，构建认知状态
3. **Queue** - 推入队列（FIFO 处理）
4. **Respond** - 基于记忆生成回复

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Enter` | 推入队列 |
| `Shift+Enter` | 插入换行 |
| `/now msg` | 立即执行（跳过队列）|
| `Ctrl+T` | 创建新 Tab |
| `Ctrl+←→` | 切换 Tab（最后一个时创建新 Tab）|
| `Esc` | 清空/重新编辑 |
| `?` | 帮助 |
| `Ctrl+C` | 退出 |

## 启动

```bash
# 服务端
bun run src/api-ws.ts

# TUI（新终端）
cd tui-react && bun run dev
```

## 项目结构

```
tui-react/src/
├── components/       # UI 组件
│   ├── ContentArea.tsx
│   ├── TabBar.tsx
│   ├── StatusBar.tsx
│   └── HelpOverlay.tsx
├── hooks/            # 逻辑 hooks
│   ├── useTabs.ts
│   └── useWebSocket.ts
├── utils/            # 工具函数
│   └── tab.ts
├── types.ts          # 类型定义
├── App.tsx           # 主应用
└── main.tsx          # 入口
```

> **KISS 原则**: 每个文件 ~200 行，单一职责，清晰封装。
