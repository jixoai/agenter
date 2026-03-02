# IFLOW_HELP

- iflow 是 AgentCLI，是编程工作流执行器
- 输入必须是可执行动作，避免空洞描述
- 需要提交时使用 enter 提交
- 使用`/model`可以切换免费模型

## Shell mode safety (must follow)

- 默认不要使用 `!`。优先直接用 iFlow 的自然语言任务流。
- 只有必须执行 shell 命令时才用 `!`，并且必须一次性写完整命令（禁止单独发送 `!`）。
- 每次使用 `!` 后，必须检查底部状态栏是否出现 `shell mode enabled`。
- 如果出现 `shell mode enabled`，必须立刻退出 shell mode：
  - 发送 `<key data="escape"/>`（不要再发送普通文本）。
- 退出后必须再次确认状态栏中不再显示 `shell mode enabled`，再继续后续任务。

## Tips for getting started

1. Create IFLOW.md files by /init command and then customize your interactions with iFlow.
2. Type /docs for document, and /demo for a quick demo.
3. Smart mode is enabled by default, use shift + tab/alt + m to switch modes.
4. Use tab to switch think mode.
5. Paste images using control+v (not cmd+v!)
6. Add context: Use @ to specify files for context (e.g., @src/myFile.ts) to target specific files or folders.
7. Shell mode: Execute shell commands via ! (e.g., !npm run start) or use natural language (e.g. start server).

## Commands
- /about - show version info
- /language - change the language
   - zh-CN - 简体中文
   - en-US - English
- /agents - Commands for interacting with agents.
   - list - List available agents.
   - refresh - Refresh agents from source files.
   - online - Browse and install agents from online repository
   - install - Install a new agent with guided setup
- /2025 - View 2025 Annual Report
- /auth - change the auth method
- /bug - submit a bug report
- /chat - Manage conversation history.
   - list - List saved conversation checkpoints
   - save - Save the current conversation as a checkpoint. Usage: /chat save <tag>
   - resume - Resume a conversation from a checkpoint. Usage: /chat resume <tag>
   - delete - Delete a conversation checkpoint. Usage: /chat delete <tag>
- /clear - clear the screen and conversation history
- /cleanup-checkpoint - clear all checkpoint history and free up disk space
- /cleanup-history - clear conversation history for the current project and free up disk space
- /commands - Manage marketplace commands: list local, browse online, get details, add/remove from CLI (project/global scope)
   - list - List locally installed commands from project and global scopes
   - online - Browse available commands from online marketplace in an interactive dialog
   - get - Get details about a specific command by ID
   - add - Add a specific command by ID to local CLI (use --scope global for system-wide install)
   - remove - Remove a locally installed command (use --scope global to remove from global)
- /compress - Compresses the context by replacing it with a summary. (aliases: /compact, /summarize)
- /copy - Copy the last result or code snippet to clipboard
- /demo - Interactive task for research and brainstorming workflows
- /docs - open full iFlow CLI documentation in your browser
- /directory - Manage workspace directories
   - add - Add directories to the workspace (absolute path); use comma to separate multiple directories
   - show - Show all directories in the workspace
- /editor - set external editor preference
- /export - Export conversation history
   - clipboard - Copy the conversation to your system clipboard
   - file - Save the conversation to a file in the current directory
- /extensions - list active extensions
- /help - for help on iflow-cli
- /ide - manage IDE connection
- /init - Analyzes the project and creates or updates a tailored IFLOW.md file.
- /log - show current session log storage location
- /mcp - list configured MCP servers and tools, browse online repository, or authenticate with OAuth-enabled servers
   - list - Interactive list of configured MCP servers and tools
   - auth - Authenticate with an OAuth-enabled MCP server
   - online - Browse and install MCP servers from online repository
   - refresh - Refresh the list of MCP servers and tools, and reload settings files
- /memory - Commands for interacting with memory.
   - show - Show the current memory contents.
   - add - Add content to the memory.
   - refresh - Refresh the memory from the source.
   - list - List all memory files.
- /model - change the model
- /qa - intelligent Q&A based on knowledge base retrieval
- /quit - exit the cli
- /statusline -  Set up iFlow status line UI
- /resume - Resume a previous conversation from history
- /skills - Manage skills
   - list - Interactive list of configured skills
   - refresh - Refresh the list of skills
   - online - Browse online skills marketplace
- /stats - check session stats. Usage: /stats [model|tools]
   - model - Display model usage statistics
   - tools - Display tool usage statistics
- /theme - change the theme
- /terminal-setup - Install Shift+Enter key binding for newlines in input box
- /tools - list available iFlow CLI tools
- /update - update version
- /vim - toggle vim mode on/off
- /setup-github - Set up GitHub Actions
- ! - shell command

## Keyboard Shortcuts

- Alt+Left/Right - Jump through words in the input
- Ctrl+C - Quit application
- Ctrl+G - Toggle help dialog
- Ctrl+J - New line
- Ctrl+L - Clear the screen
- Ctrl+X / Meta+Enter - Open input in external editor
- Ctrl+Y - Toggle YOLO mode
- Ctrl+O - Toggle debug console display
- Ctrl+V - Image paste
- Enter - Send message
- Esc - Cancel operation
- Shift+Tab / Alt+M - Toggle mode
- Up/Down - Cycle through your prompt history
