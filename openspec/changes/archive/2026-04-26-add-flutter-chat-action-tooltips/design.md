## Context

After the route-depth and detent work, compact product-shell actions are intentionally icon-only: profiles, details, new profile, close, and overflow actions fit in the navigation and sheet chrome without text labels. Semantics labels are present, but visible discoverability for mouse/trackpad users and long-press touch users is still weak.

## Goals / Non-Goals

**Goals:**

- Add tooltip behavior once at `AppleIconButton`.
- Reuse the existing localized label as the tooltip text.
- Preserve exactly one semantic button per action.
- Keep 44pt minimum hit targets.

**Non-Goals:**

- Do not introduce a bespoke Cupertino tooltip implementation.
- Do not change route-depth, sheet detents, or action hierarchy.
- Do not add tooltips to message bubbles or transcript content in this pass.

## Decisions

### Decision 1: Tooltip belongs to the icon primitive

`AppleIconButton` owns tooltip wrapping because it already owns localized labels, hit target size, and icon-only semantics. Feature code should not wrap every call site in ad-hoc tooltip widgets.

### Decision 2: Tooltip semantics stay excluded

The tooltip is visible help, not a second accessible name. `AppleIconButton` keeps its explicit `Semantics` wrapper as the only semantic button and excludes tooltip semantics to prevent duplicate labels.

## Risks / Trade-offs

- [Risk] Flutter has Material `Tooltip`, not Cupertino `Tooltip`. Mitigation: use it only as a lightweight overlay helper and keep visual claims conservative.
- [Risk] Tooltip may affect semantics. Mitigation: set `excludeFromSemantics` and keep widget tests for labels/hit targets.

## Migration Plan

1. Wrap `AppleIconButton` internals with tooltip help.
2. Add widget tests for tooltip discovery and unchanged hit target.
3. Sync docs/spec and validate.
