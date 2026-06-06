# User Review: Context Official Progressbar / ListButton

## Objective Feedback

- Context usage should use the official Framework7 `Progressbar` component.
- The Compact button inside Context usage should use the official Framework7 `ListButton` component, following the `List` + `ListButton` pattern.

## Scope Decision

- Keep the bottom Toolbar context ring as the compact toolbar trigger progress indicator from the previous accepted requirement.
- Replace the Context usage Sheet's internal custom progress display with `Progressbar`.
- Replace the Compact action row with `ListButton` while keeping the existing official confirm dialog and host-provided compact callback.
