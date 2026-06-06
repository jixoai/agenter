# User Review: Acceptance Polish

## User Feedback

- Some cards do not need a `Compact / Detailed` switch; do not show it when it has no value.
- User-made style adjustments are accepted state and must not be rolled back.
- Tool-call rows should not show visible text states such as `DONE`; use color plus icon instead.
- Replace the bottom Compact button icon.
- The bottom Config button's modal sheet has no entrance animation even though the official demo does; it currently pops in but animates out.
- The Config sheet still does not match the official Modal Sheet style. The header toolbar is inconsistent, and the content should be organized by official ListView/List components, especially Thinking as an official toggle.
- UserMessage and AssistantMessage are not distinguished. UserMessage avatar should be on the right.

## Implementation Plan

- Preserve current CSS/layout edits unless a specific feedback item requires a narrow additive change.
- Gate row layout controls by whether compact and detailed rendering differ.
- Convert tool-call state text into state icons with accessible labels and state color.
- Use a non-sparkle compact icon in the official Framework7 bottom toolbar.
- Mount the config Sheet closed and open it after Svelte `tick()` so Framework7 can run the entrance transition.
- Rebuild config Sheet form rows with Framework7 `List`, `ListInput`, `ListItem`, and `Toggle`.
- Add role-aware Heartbeat entry alignment using existing persisted role facts only.

## Implementation Result

- Plain text/markdown rows no longer render the `Compact / Detailed` segmented control; rows with tool blocks, reasoning, or compact prompt facts still expose it.
- Tool-call summaries no longer render visible state text. State is represented by colored icons with accessible labels such as `Tool done`.
- The bottom Compact toolbar action now uses an archive icon instead of the sparkle icon, while staying an official Framework7 `Link iconOnly`.
- The config Sheet is mounted closed and opened after `tick()`, allowing Framework7 to apply its modal entrance path.
- The config Sheet content is organized through Framework7 list components, with Thinking represented by an official `Toggle`.
- User-role Heartbeat sections now place the avatar in the right grid column on mobile and desktop; assistant rows remain left-aligned.

## Evidence

- `bun run --filter '@agenter/web-heartbeat-view' typecheck`: pass, 0 errors, 0 warnings.
- `bun run --filter '@agenter/web-heartbeat-view-example' typecheck`: pass, 0 errors, 0 warnings.
- `bun run --filter '@agenter/web-heartbeat-view' test`: pass, 3 unit files / 15 tests, 1 Storybook browser test, 1 DOM browser file / 7 tests.
- `bun run --filter '@agenter/web-heartbeat-view-example' test`: pass, 1 file / 11 tests.
- Svelte autofixer: no issues for `heartbeat-statusbar`, `heartbeat-tool-block`, and `heartbeat-group`; `heartbeat-entry` only retained known prop-sync/clock tick suggestions.
- Agent-browser mobile metric: `toolStateTexts=[]`, `toolIcons` had green `Tool done` labels, `layoutToggleCount=3`, `entriesWithoutToggle=4`, and user avatar `gridColumnStart=2`.
- Agent-browser config Sheet metric: immediate sheet DOM was `null`, next frame became `sheet-modal ... modal-in`, `hasToggle=true`, and `listCount=1`.
- Browser errors after the pass: none.
- Screenshot: `.screenshot/web-heartbeat-view/agent-mobile-acceptance-polish-config-sheet.png`.
