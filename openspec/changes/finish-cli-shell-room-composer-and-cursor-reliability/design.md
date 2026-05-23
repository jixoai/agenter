## Context

This change stays strictly inside the cli-shell extension product boundary:

- TerminalSystem still owns terminal truth
- MessageSystem still owns room truth
- Attention-backed authorization continues to evolve in `fix-review-cli-shell-attention-authorization`
- tmux remains a local presentation/runtime host, not shell truth

The remaining bugs are product-composition bugs.

## Decisions

### 1. Cursor regression must be caught as a runtime projection bug, not a source-string smell

The current shell-pane tests only prove that certain cursor lines exist in source code. That is not enough. The extension already has historical tests that validate a scrolled absolute cursor row against a visible local viewport. This change restores that testing discipline for the current shell-pane path.

The lawful stack remains:

1. shell-pane projection computes a 0-based viewport-local cursor
2. native cursor commit converts that cursor into 1-based screen coordinates
3. no intermediate layer is allowed to re-own cursor truth or move the `+1`

### 2. cli-shell owns its own product config files

cli-shell should not write into the shared core settings truth. It gets its own fixed directory:

- `~/.agenter/cli-shell/settings.json`
- `~/.agenter/cli-shell/keybindings.json`

`settings.json` stores durable product behavior such as the preferred Chat layout.  
`keybindings.json` stores product shortcut bindings only.

### 3. Room composer becomes a small host, not a bigger input

The composer area needs three modes:

- `textarea`: ordinary multiline editing
- `panel`: slash-command panel such as `/history`
- `confirm`: inline confirmation surface such as "replace current draft?"

This avoids baking special cases directly into the Room root.

### 4. `/history` is the first panel command

`/history` loads older room messages from the existing paged message API. It renders a selectable list in the composer area.

- if the current textarea is empty, choosing a history item inserts it at the cursor
- if the current textarea is non-empty, cli-shell opens an inline confirm panel
- the confirm panel offers:
  - clear current draft and fill
  - keep current draft and insert at cursor

### 5. Send success and refresh failure are separate facts

The Room composer currently clears the draft only after a forced hydrate succeeds. That is wrong.

The corrected product law is:

1. send returns success -> clear draft, pin to bottom, show send success
2. refresh runs separately
3. refresh failure is surfaced as a follow-up notice, not as a false send failure

### 6. Chat layout persistence is singleton product state

cli-shell still has only one Chat surface per session. The persisted default layout controls how Chat opens from the bottom bar when currently closed:

- `left`
- `right`
- `cover`

Open/close state itself is runtime state. The default layout is durable product preference.
