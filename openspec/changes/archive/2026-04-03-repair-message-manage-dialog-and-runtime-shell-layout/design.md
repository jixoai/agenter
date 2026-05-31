## Context

The current Svelte migration preserved the high-level features but not the intended shell composition.

For `Messages`, the transcript route is correct in principle, but the management dialog incorrectly combines a dialog, a sidebar primitive, and a stretchable detail region. The result is a dialog that owns too much blank space and a detail area that does not read like a deliberate administration surface.

For the runtime shell, the page currently renders a top hero, one large content card, and one right card. That satisfies routing, but not information architecture. The primary stage lacks enough structure to explain what the current tab is for, while the right rail duplicates visual weight with large empty cards.

## Goals / Non-Goals

**Goals**

- Give the room-management dialog one explicit rail and one explicit detail stage
- Ensure all stretchable dialog sections and runtime rails are owned by `ScrollView`
- Rebuild runtime tabs so the selected tab has a strong primary surface and the right rail stays secondary
- Preserve current app capabilities and routes while improving layout lawfulness

**Non-Goals**

- Change message-system semantics or room authorization rules
- Reintroduce inline management rails on the main `Messages` page
- Add new runtime tabs or new backend data

## Decisions

### Dialog management uses a two-column shell, not a full app sidebar transplant

Inside the room-management dialog, the left column will be a narrow management rail and the right column will be a detail stage. The right stage will include a compact top summary surface plus a `ScrollView`-owned content region. We will not transplant the full app-shell sidebar behavior into the dialog.

### Runtime shell uses primary-stage cards plus a quiet secondary facts rail

The runtime shell will keep the page header and peer tabs, but the tab content will be reorganized as semantic primary-stage sections. `Attention` will get a summary band plus a main state card. The right rail will remain available for linked systems and runtime facts, but with smaller, quieter cards and clearer grouping.

### Scroll ownership stays explicit

Dialog detail content, runtime primary stage, and runtime right rail will each have one clear `ScrollView` owner. Wrapper grids and panel shells will not take raw overflow responsibility.

## Risks / Trade-offs

- [Risk] The dialog may become denser on narrow viewports. -> Mitigation: collapse the two-column dialog shell to one column under smaller breakpoints while preserving section switching.
- [Risk] A calmer right rail could hide useful facts. -> Mitigation: keep all existing facts, but group and tone them as secondary metadata instead of main-stage cards.
- [Risk] Story and E2E checks may need fixture updates. -> Mitigation: add assertions around the new section shell rather than brittle pixel assumptions.
