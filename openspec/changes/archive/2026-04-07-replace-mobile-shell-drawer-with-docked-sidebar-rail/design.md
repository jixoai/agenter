## Context

The shared `Sidebar` primitive currently branches on `sidebar.isMobile` and renders a `Sheet` for compact viewports. That older law assumed mobile navigation should disappear until reopened through a trigger. The more recent shell requirement is different: the left rail is the persistent window switcher, so compact layouts may collapse it to an icon rail but must not hide it behind a drawer.

This means the defect is not page-local. The platform law itself is wrong for the app shell.

## Goals / Non-Goals

**Goals:**

- Keep the left application rail visible on compact viewports.
- Preserve `Sidebar` flexibility so non-shell consumers can still use sheet/offcanvas behavior if needed.
- Keep sidebar collapse/expand control inside the sidebar chrome rather than reintroducing page-local toggles.

**Non-Goals:**

- Redesign the app shell information architecture.
- Remove sidebar sheet behavior from every consumer globally.
- Rework running-avatar secondary navigation semantics beyond keeping them attached to `Avatars`.

## Decisions

### Sidebar exposes an explicit mobile presentation mode

The shared `Sidebar` primitive will accept a mobile presentation mode. The default remains sheet/offcanvas for existing consumers, while the app shell opts into a docked mode that reuses the fixed-sidebar branch even on compact widths.

Alternative considered:

- Hardcode the app shell around viewport classes and bypass the shared sidebar primitive.
  Why rejected: that would duplicate shell law and create another direct coupling between app shell and responsive sidebar internals.

### Compact app shell defaults to a collapsed icon rail, not a hidden drawer

The app shell will keep the compact sidebar visible by default as the collapsed icon rail. Operators can still expand it from within the sidebar chrome when they need labels or nested session entries.

Alternative considered:

- Keep the drawer model and only add another trigger in page chrome.
  Why rejected: that directly conflicts with the requirement that the window switcher itself stay present and that page chrome stop owning sidebar controls.

## Risks / Trade-offs

- [Risk] Docked compact rails reduce page width. -> Mitigation: compact shell defaults to icon collapse instead of full-width expansion.
- [Risk] Sidebar primitive gains another configuration branch. -> Mitigation: keep the API explicit and default-preserving, and cover it with focused contract tests.
