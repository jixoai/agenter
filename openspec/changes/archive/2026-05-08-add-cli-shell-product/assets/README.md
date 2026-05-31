# Cli-shell App References

This directory intentionally keeps only final-review assets for the accepted v8 terminal-grid direction.

## Final v8 design references

- `cli-shell-app-reference-v8-toolbar-grid.png`
- `cli-shell-app-reference-v8-dialogue-right-grid.png`

These PNGs are the final app-effect references for this change. They show the collapsed one-row bottom toolbar and the explicit dialogue panel opened on the right, rendered as terminal character-cell output rather than Web-style panels.

## Paired source and grid contract

- `cli-shell-app-reference-v8-toolbar-grid.svg`
- `cli-shell-app-reference-v8-toolbar-grid.txt`
- `cli-shell-app-reference-v8-dialogue-right-grid.svg`
- `cli-shell-app-reference-v8-dialogue-right-grid.txt`

The SVG files are deterministic vector companions for the PNG design references. The TXT grids are the auxiliary terminal-cell contracts. Together they define rows, columns, split lines, minimal floating borders, gutter columns, scrollbar columns, short time placement, date-divider rows, input row, and one-row toolbar ownership. Implementation must render through terminal character cells with terminal-width semantics for emoji and CJK glyphs.

## Removed exploration assets

Earlier v1-v7 exploration images and the rejected SVG rasterization attempts are removed from the final asset set. Their architectural lessons are captured in `../design.md` and `../audit.md`; keeping stale visual targets would make the accepted v8 direction ambiguous.
