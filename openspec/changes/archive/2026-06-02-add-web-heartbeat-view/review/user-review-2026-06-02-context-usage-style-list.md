# User Review: Context Usage Style / List Polish

## Objective Feedback

- Bottom Toolbar controls should be visually balanced; the left Context usage control currently occupies most of the toolbar.
- The bottom context ring is a progress indicator. It should have a muted track and a progress color that transitions from green to orange to red, using `color-mix()` in `oklch` or `oklab`.
- The Context usage Sheet should reuse the manually accepted Modal Sheet styling from the previous pass; ideally all Heartbeat Modal Sheets should share that styling.
- Context usage content should fully use official Framework7 ListView/ListItem structure, matching the direction already applied to Next call config.

## Scope Decision

- Keep backend/client-sdk endpoint shapes unchanged.
- Treat this as UI primitive cleanup under the existing Framework7 law.
- Preserve user-authored style adjustments and generalize them instead of replacing them.
