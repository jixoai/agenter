## Context

Current compact Flutter shell law is `ProductShellTab { profiles, conversation, details }` rendered by `IndexedStack` plus `_CompactNavigationBar`. That makes the active chat route share the bottom edge with app navigation.

Official Apple evidence points in a different direction:

- `references/apple-ios26-messages-custom-background.jpg`: active Messages conversation keeps the bottom edge for composer input and uses top chrome for back/contact/action affordances.
- `references/apple-ios26-messages-polls.jpg`: rich chat capabilities are embedded in the conversation or contextual surfaces; they do not become persistent bottom tabs.
- `references/apple-liquid-glass-hero.jpg`: iOS 26 chrome can be translucent/adaptive, but content remains primary; chrome should not compete with core task surfaces.
- Apple HIG tab bars remain appropriate for switching between peer top-level app areas, not for active conversation substructure.
- Apple HIG navigation bars, sheets, menus/actions, and popovers are the right primitives for hierarchy, secondary actions, and contextual detail.

The current bottom-tab compact route is therefore not a style bug. It is a platform-law mismatch: profile management, active conversation, and selected-message inspection are different route depths, not three equivalent destinations.

## Goals / Non-Goals

**Goals:**

- Make compact chat conversation-first: transcript and composer own the active chat screen.
- Remove persistent bottom nav from the compact active chat page.
- Replace tab equality with a typed route-depth model that can project to compact, standard, and expanded layouts.
- Preserve all current capabilities: profile activation, room facts, participants, selected-message detail, share link, profile edit, reconnect, disconnect.
- Use official Cupertino primitives for secondary/tertiary UI: navigation actions, pushed pages, sheets, action sheets, popovers/menus where Flutter supports them.
- Keep the reusable package atoms orthogonal: controller/model/rendering remain package law; app routing and profile chrome remain example host shell law.

**Non-Goals:**

- Do not invent a new room websocket protocol, transport adapter, or profile persistence scheme.
- Do not fake unsupported iOS 26 Liquid Glass effects with custom blur/glass cards.
- Do not move app shell routing into the reusable `lib/` package.
- Do not redesign transcript bubble rendering, markdown, upload protocol, or composer plugin law except where route chrome needs new action entry points.

## Decisions

### Decision 1: Replace compact tabs with route depth

**Recommended option A — route-depth law.**

Introduce a host-shell route model that expresses current compact depth explicitly:

- `conversation`: primary chat stage.
- `profileDirectory`: secondary profile selection/management surface.
- `roomInspector`: secondary room facts + participants surface.
- `messageInspector(viewKey)`: tertiary selected-message surface.

Expanded width projects the same model as persistent sidebars: profile rail + conversation + detail inspector. Standard width projects profile rail + conversation, with details as a transient inspector. Compact width projects conversation as the root route and opens the other depths through push/sheet surfaces.

This is the architecture-first fix because the new law matches the app semantics. Profiles are workspace selection, room facts are inspector data, and selected-message facts are contextual detail; none are peer top-level tabs.

**Rejected option B — hide the bottom nav only on chat.**

Keeping `ProductShellTab` and conditionally hiding `_CompactNavigationBar` on the conversation tab would leave stale state transitions (`selectMessage → details tab`) and duplicate navigation semantics. It would produce invisible routes, keyboard shortcuts that point to hidden tabs, and future glue for every secondary affordance.

### Decision 2: Chat stage owns bottom edge; shell owns top-level entry points

Compact active chat SHALL reserve the bottom edge for the composer and safe-area spacing. App-level and room-level actions move to top chrome:

- Leading navigation action opens/pushes profile directory.
- Middle title/subtitle identifies the active room.
- Trailing primary action opens the room/action menu.
- Details affordance appears as a trailing info/action item or contextual message action.

This follows the Messages reference: the active conversation has top back/contact/action affordances and a bottom composer, not bottom app tabs.

### Decision 3: Inspector presentation adapts by constraint

The same `DetailRail` content remains an inspector atom, but its presentation changes:

- expanded: persistent trailing inspector surface.
- standard: inspector sheet or side overlay launched from stage top chrome.
- compact: pushed detail page or bottom sheet for room facts; selected-message detail uses a pushed route or sheet that can be dismissed back to chat.

The host shell chooses presentation from `ProductShellLayout`; `DetailRail` should not know whether it is embedded, pushed, or sheeted.

### Decision 4: Actions are contextual surfaces, not route destinations

Profile edit, reconnect, disconnect, import, share link, participant/message operations, and future secondary actions SHALL live in:

- `CupertinoActionSheet` for compact destructive or multi-action choices.
- `CupertinoContextMenu` / menu-style action where appropriate for message-local actions.
- `CupertinoPopupSurface` / popover-style projection for pointer-rich wider layouts when Flutter has stable primitives.
- Navigation trailing icon actions for one-step primary/secondary affordances.

This keeps the platform law simple: routes express hierarchy; menus/sheets express actions.

### Decision 5: Animation communicates hierarchy only

Use motion for route-depth transitions and transient inspector presentation:

- compact profile directory / room inspector: Cupertino route transition or modal sheet transition.
- selected-message inspector: lightweight push/sheet transition from message selection.
- standard/expanded inspector appearance: restrained cross-fade or slide tied to selection state.

Do not add decorative background motion, parallax, or glass animation. The app remains chat-first and text-first.

## Risks / Trade-offs

- [Risk] Flutter Web cannot perfectly reproduce native iOS 26 Liquid Glass materials → Mitigation: use stable Cupertino semantics and avoid fake glass.
- [Risk] Removing tabs could hide profile/details access → Mitigation: add explicit leading/trailing navigation actions, keyboard shortcuts, and widget tests for reachability.
- [Risk] Route-depth state can become another controller responsibility blob → Mitigation: keep route state as a host-shell atom, not part of `ChatViewController`.
- [Risk] Sheets/push pages can duplicate `DetailRail` logic → Mitigation: keep `DetailRail` as the content atom and wrap it with presentation-specific shell atoms.
- [Risk] Browser/WASM behavior can regress due to route transitions and scroll lifecycle → Mitigation: test compact route transitions and run Web/WASM walk-through before reporting completion.

## Migration Plan

1. Add host-shell route-depth model and controller commands.
2. Replace compact `IndexedStack + _CompactNavigationBar` with conversation root plus secondary route/sheet entry points.
3. Preserve standard/expanded split layouts by projecting the same route state into persistent rails.
4. Move compact message selection from “switch to details tab” to “open message inspector”.
5. Update localization, keyboard shortcuts, widget tests, `DESIGN.md`, `SPEC.md`, and delta specs.
6. Validate with Flutter analyze/test plus Web/WASM manual route walk-through.

Rollback is mechanical: the previous `ProductShellTab` code can be restored, but that should be treated as a temporary app regression because it reintroduces bottom navigation on active chat.

## Open Questions

- Flutter stable availability for true menu/popover primitives on Web should be checked during implementation. If unstable, use `CupertinoActionSheet`/pushed route as the stable baseline.
- Standard-width inspector presentation should be chosen during implementation after measuring available width in the real Web build: side overlay if it preserves transcript measure, sheet if it does not.
