## Context

The `Terminals` route renders a terminal viewport plus a collaboration rail. Browser evidence shows that the rail width can become much narrower than the page viewport. The current Users pane decides between its stacked and inline grant-access layouts by calling `window.matchMedia('(max-width: 1023.98px)')`, so a wide desktop viewport still forces the inline layout even when the rail itself is only about `344px` wide.

That mismatch corrupts the inline header: `Grant actor` collapses and its hit target is covered by `Grant role`, which makes desktop seat grants impossible while the mobile stacked path continues to work.

## Goals / Non-Goals

**Goals:**

- Derive the Users grant-access layout from the pane width instead of the global viewport width.
- Preserve one stable stacked fallback that works for both mobile and narrow desktop rails.
- Add focused regression coverage for the layout law.

**Non-Goals:**

- Redesign the rest of the terminal collaboration surface.
- Change seat grant semantics, approval semantics, or focus/revoke flows.
- Introduce a new global responsive-layout framework beyond this local repair.

## Decisions

### Observe the Users pane width directly

The Users pane will observe its own rendered width and derive a compact-or-wide layout from that local width. This keeps the responsive law attached to the collaboration rail instead of the whole window.

Alternative considered:

- Keep using viewport media queries and tweak the breakpoint.
  Why rejected: the bug happens specifically because the collaboration rail is narrower than the viewport, so a viewport-only breakpoint can never model the real constraint.

### Reuse the existing stacked grant-access layout as the narrow fallback

The current compact branch already keeps the three grant controls independently usable. The repair will reuse that branch for narrow pane widths instead of inventing a second desktop-only fallback.

Alternative considered:

- Keep one inline desktop row and only adjust the fixed grid columns.
  Why rejected: it reduces overlap risk but still leaves the layout brittle for narrow rails inside split views.

## Risks / Trade-offs

- [Risk] A local width threshold may need tuning later if the collaboration rail design changes. -> Mitigation: isolate the threshold in a helper and cover it with a focused spec.
- [Risk] Resize observation adds one local reactive dependency. -> Mitigation: scope it to the Users pane only and keep the fallback branch identical to the existing compact UI.
