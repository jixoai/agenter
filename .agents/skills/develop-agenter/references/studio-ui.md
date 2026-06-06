# Studio UI Reference

## Storybook DOM Contract

- Prefer Storybook DOM tests for real browser-dependent interactions:
  - CodeMirror
  - dialogs/sheets/popovers
  - list selection and composite panels
- Stories are the single source of truth for component interaction state.
- Reuse stories in tests via `composeStories(...).run()`.
- Useful commands:
  - `bun run --filter 'agenter-app-studio' storybook`
  - `bun run --filter 'agenter-app-studio' storybook:build`
  - `bun run --filter 'agenter-app-studio' test:unit`
  - `bun run --filter 'agenter-app-studio' test:dom`

## Viewport and Browser QA

- Always validate desktop and mobile for Studio UX.
- Default mobile baseline: `iPhone 14`.
- Browser walkthroughs should capture:
  - expected
  - actual
  - evidence path
  - pass/fail by viewport
- Mobile must follow the real compact navigation path, not a desktop shortcut.

## Layout / Scroll Law

- Do not use raw `overflow-hidden` as a generic layout fix.
- Do not use `min-h-0` as the project’s default scroll workaround.
- Every major panel should have one explicit scroll owner.
- Use shared primitives such as `ScrollView`, `ViewportMask`, and `ClipSurface` instead of hand-rolled clipping and scroll behavior.
- If you remove clipping, verify the scroll owner still exists.

## UI Architecture

- Separate app shell, workspace shell, route surface, and content body.
- Avoid repeating the same fact across adjacent UI layers.
- Keep primary actions singular per surface.
- Keep global navigation and local navigation separate.

## Operator Noise Discipline

- Design Studio pages for expert operators who use the app for long sessions.
- Do not spend primary page space teaching facts an operator can infer from labels, state, and affordances.
- Put explanations, caveats, and recovery notes behind `HelpHint`, tooltips, or focused empty/error states instead of persistent body copy.
- Avoid nested cards and repeated borders; use the app shell, split-detail primitives, spacing, and lightweight dividers as the main structure.
- If a line of text only explains the UI instead of changing a decision, state, or next action, remove it or collapse it into contextual help.

## Typography / Icon / Affordance Rules

- Fonts are token-driven from global CSS variables; do not scatter `font-family`.
- Use semantic typography classes before local magic numbers.
- Use `lucide-react` for action/status icons.
- Use shared affordance primitives for icon + text surfaces; feature code should not hand-roll spacing/padding patterns.
- Tooltip only hides non-critical explanations; critical state must remain visible.

## Chat / Inspector Rules

- Preserve raw user input as the source truth.
- Treat rendered Markdown, previews, badges, or inspector views as projections.
- Normalize chat rows before rendering instead of composing runtime state ad hoc inside JSX.
- Keep tooling detail secondary to the conversation surface.
