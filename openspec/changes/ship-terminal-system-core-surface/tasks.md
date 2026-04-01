## 1. Spec And Data Adapters

- [ ] 1.1 Author the terminal-system proposal, design, and capability spec.
- [ ] 1.2 Build Svelte data adapters/selectors for global terminals, terminal activity, grants, approval requests, and auth/profile actor projections.
- [ ] 1.3 Add shared terminal identity/access presentation helpers so terminal users align with the message-system surface.

## 2. Terminal-System Surface

- [ ] 2.1 Implement the `/terminals` route with terminal list, transcript pane, and `Actions / Users` side panel.
- [ ] 2.2 Implement terminal tool-call controls with explicit actor selection in the actions pane.
- [ ] 2.3 Implement terminal metadata rendering, including durable transcript refresh and absolute `cwd` display.

## 3. Access, Focus, And Verification

- [ ] 3.1 Implement terminal access dialogs and approval request handling with auth-backed actors.
- [ ] 3.2 Move focus/unfocus controls into per-user seat state in the users pane and remove terminal-global focus controls.
- [ ] 3.3 Add Storybook/Playwright coverage for terminal activity rendering, actor-based tool calls, access mutations, and seat focus behavior.
