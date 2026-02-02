# Agenter TUI - Queue Workflow

基于队列的工作流终端界面。支持多 Tab 并行编辑、队列处理、立即执行。

## 界面布局

```
┌─────────────────────────────────────────────────────────────────┐
│ 1[1/3]  2  3✎  4                                                │  ← Tab列表
│ Queue: 3                                                        │
├─────────────────────────────────────────────────────────────────┤
│ ✎ Editing                                                       │  ← 状态指示
├─────────────────────────────────────────────────────────────────┤
│ Type your message (Ctrl+Enter=Queue, Shift+Enter=Now, /help)... │  ← USER输入区
│ Hello, what is this project?                                    │
├─────────────────────────────────────────────────────────────────┤
│ tool: MemoryManager.getRecentFacts(...)                         │  ← MEMORY (紫色)
├─────────────────────────────────────────────────────────────────┤
│ This project is a demonstration...                              │  ← ANSWER (绿色)
└─────────────────────────────────────────────────────────────────┘
● Connected | Queue: 3 | Ctrl+Enter=Queue | Shift+Enter=Now | /help | ←→=Switch
```

## 使用 `/help`

在输入框中输入 `/help`，然后按 `Ctrl+Enter` 或 `Shift+Enter`，当前 Tab 会显示帮助信息：

```
## Keyboard Shortcuts

### Editing Tab
- Ctrl+Enter     Push to queue
- Shift+Enter    Execute immediately  
- Enter          New line
- Backspace      Delete character

### Global Navigation
- ←/→            Switch tabs
- Alt+←/→        Jump 10 tabs
- Enter          Find editing tab or create new
- Esc            Re-edit waiting/finished tab
```

## Tab 状态

| 状态 | 指示 | 说明 |
|------|------|------|
| **editing** | `✎` 白色 | 可编辑，正在输入 |
| **waiting** | `⏳` 蓝色 [1/3] | 在队列中等待 |
| **running** | `▶` 紫色 | 正在执行 |
| **finished** | `✓` 绿色 | 已完成 |

## 快捷键

### Editing 状态（输入框中）

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Enter` | 推入队列（editing → waiting） |
| `Shift+Enter` | 立即执行（editing → running） |
| `Enter` | 换行 |
| `Backspace` | 删除字符 |

### 全局快捷键

| 快捷键 | 功能 |
|--------|------|
| `←/→` | 切换 Tab |
| `Alt+←/→` | 跳 10 个 Tab |
| `Enter` | 找 editing Tab 或创建新 Tab |
| `Esc` | 将 waiting/finished Tab 转为 editing |
| `Ctrl+C` | 退出 |

## 队列工作流

1. **创建消息**：在 editing Tab 输入内容
2. **推入队列**：`Ctrl+Enter`，Tab 变为 `⏳ Waiting [1/3]`
3. **继续工作**：按 `Enter` 自动跳到下一个 editing Tab
4. **队列处理**：自动按 FIFO 顺序执行

## 立即执行

不想等待队列？使用 `Shift+Enter` 立即执行当前 Tab，不占用队列位置。

## 帮助命令

输入 `/help` 后按 `Ctrl+Enter` 或 `Shift+Enter`，在当前 Tab 显示帮助信息。

## 启动

```bash
# Windows
.\start.ps1

# macOS/Linux  
./start.sh
```
