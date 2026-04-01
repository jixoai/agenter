## 1. Spec And Data Adapters

- [x] 1.1 Author the terminal-system proposal, design, and capability spec.
- [x] 1.2 Build Svelte data adapters/selectors for global terminals, terminal activity, grants, approval requests, and auth/profile actor projections.
- [x] 1.3 Add shared terminal identity/access presentation helpers so terminal users align with the message-system surface.

## 2. Terminal-System Surface

- [x] 2.1 Implement the `/terminals` route with terminal list, transcript pane, and `Actions / Users` side panel.
- [x] 2.2 Implement terminal tool-call controls with explicit actor selection in the actions pane.
- [x] 2.3 Implement terminal metadata rendering, including durable transcript refresh and absolute `cwd` display.

## 3. Access, Focus, And Verification

- [x] 3.1 Implement terminal access dialogs and approval request handling with auth-backed actors.
- [x] 3.2 Move focus/unfocus controls into per-user seat state in the users pane and remove terminal-global focus controls.
- [x] 3.3 Add Storybook/Playwright coverage for terminal activity rendering, actor-based tool calls, access mutations, and seat focus behavior.
