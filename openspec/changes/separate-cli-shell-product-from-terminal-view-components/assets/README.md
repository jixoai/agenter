# Cli-shell ChatTUI v9 References

This directory contains deterministic terminal-grid references for the revised ChatTUI direction in `separate-cli-shell-product-from-terminal-view-components`.

## Final v9 design references

- `cli-shell-chat-tui-reference-v9-toolbar-grid.png`
- `cli-shell-chat-tui-reference-v9-chat-right-pinned-grid.png`
- `cli-shell-chat-tui-reference-v9-chat-right-scrolled-grid.png`

The paired `.svg` files are deterministic vector companions. The paired `.txt` files are terminal-cell contracts for row/column review.

## What changed from archived v8

- The bottom row no longer prints labels such as "Heartbeat" or visible shortcut help.
- The bottom row is exactly: status icon, current streaming part, managed toggle, Chat entry with unread count.
- The user-visible panel is named Chat, stays frameless, and separates regions with background, color, whitespace, one input divider, and a scrollbar column.
- Chat scrolling follows traditional chat-room behavior: pinned-at-bottom follows new streaming output; user scroll-up freezes position and shows a compact stick-to-bottom button.
