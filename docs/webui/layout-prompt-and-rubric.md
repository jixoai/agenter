# WebUI Layout Prompt and Rubric

This document is the repository-level contract for dense WebUI layout work. Use it before generating layout code, reviewing screenshots, or scoring a shell/page change.

## Generation Prompt

```text
You are refining Agenter WebUI layout density.

Goals:
- Keep the first viewport decision-heavy and noise-light.
- Preserve route hierarchy: app-level navigation, passive top header, route-local controls, content body.
- Reuse shared primitives for async/loading, adaptive icon controls, and passive metadata disclosure.
- Prefer icon signals + tooltip for passive facts.
- Keep one visible primary session-status signal/menu at the route top edge; never duplicate it in route body chrome.
- Composer contract: editor + one action row + one thin status/help row.
- Avoid stacked padding and stacked surfaces; each layer owns one responsibility.
- Compact screens must still work at iPhone SE width.

Hard constraints:
- GlobalSettings stays in global navigation only.
- TopHeader is passive route chrome only.
- Route-local status may live in the header trailing slot, but it must stay a single compact signal/menu entry.
- Workspace path shows basename by default; full path moves to tooltip/menu/title.
- Help copy collapses before important actions collapse.
- Secondary action labels may collapse; primary send label stays visible.
- Fetch-driven panels must use `AsyncSurface`; loading, empty, and refresh remain distinct states.
- `AsyncSurface` does not own scroll, clipping, background, or padding semantics.
- Width-adaptive icon actions use `AdaptiveIconButton`; icon-only mode keeps tooltip/title/aria and symmetric padding.
- Passive metadata and secondary facts use `SurfaceSignalDisclosure` plus `Tabs.trailing`, not a dedicated extra row.
- Single-column route/panel grids must declare `grid-cols-[minmax(0,1fr)]`; implicit auto columns are not allowed for scrollable surfaces.
- Use existing primitives first; do not add new dependencies for layout-only changes.

Deliver:
- Componentized implementation.
- Storybook stories for desktop + compact viewports.
- Objective evidence payload with geometry metrics + screenshots.
```

## Review Prompt

```text
Review this Agenter WebUI change against the layout contract.

Check:
1. Is hierarchy correct? passive header, route-local controls, content body.
2. Is the first viewport compact without hiding required decisions?
3. Are passive facts reduced to icon signals / tooltip where appropriate?
4. Do fetch-driven surfaces use the shared `AsyncSurface` contract without stealing scroll/background ownership?
5. Do passive metadata/details use `SurfaceSignalDisclosure` instead of a standalone row?
6. Is there only one session-status signal/menu across desktop and compact layouts?
7. Is padding owned by one layer at a time?
8. Does compact mode preserve usability at iPhone SE width?
9. Does the composer keep one action row and one smaller status/help row?
10. Do Storybook metrics and screenshots agree with the visual result?

Score with the rubric below. Cite the evidence payload fields and screenshots. If a violation exists, name the exact surface and the rule it breaks.
```

## Rubric (100 points)

| Dimension | Weight | What passes |
| --- | ---: | --- |
| Information hierarchy | 20 | Header is passive, route controls stay route-local, no repeated facts across adjacent layers |
| Density and compactness | 20 | First viewport avoids wasted padding, oversized headers, and duplicate chrome |
| Action clarity | 15 | One clear primary action per surface; session control remains a single route-local entry |
| Adaptive behavior | 15 | Compact widths collapse secondary labels/help correctly; adaptive controls preserve the same action semantics |
| Surface ownership | 10 | Background, padding, clipping, scrolling, and async-state ownership each stay with the correct layer |
| Accessibility signals | 10 | Icon-only affordances and passive signals retain tooltip/title/aria labels |
| Test evidence quality | 10 | Stories, DOM assertions, and screenshots prove the contract objectively |

### Scoring Bands

- `90-100`: ready to ship
- `75-89`: acceptable, but with visible polish debt
- `60-74`: partial; layout contract is not stable yet
- `<60`: reject and rework

## Evidence Payload Contract

Provide both YAML preview and JSON raw payload. YAML is the human preview; JSON remains the lossless source.

### YAML preview

```yaml
change: compact-chat-density-and-layout-rubric
viewport: mobile-iphone-se
story: CompactConversationKeepsNavigationAndComposerStable
screenshots:
  - path: packages/webui/test/storybook/__screenshots__/chat-panel-compact.png
metrics:
  asyncSurface:
    state: ready-loading
    ownsScroll: false
    ownsBackground: false
  topHeader:
    heightPx: 108
    passiveSignals: 2
    workspaceTextVisible: project-alpha
    fullPathVisible: false
  routeStatus:
    visible: true
    placement: header-trailing
    duplicateBodyStatus: false
  passiveDisclosures:
    metadataAlignedWithTabs: true
    standaloneRow: false
  composer:
    actionRowHeightPx: 40
    statusRowHeightPx: 28
    secondaryLabelsCollapsed: true
    helpCollapsedToQuestionMark: true
  layout:
    horizontalOverflow: false
    stackedSurfaceCountAboveConversation: 1
scoreHints:
  compactness: pass
  hierarchy: pass
  adaptiveBehavior: pass
```

### JSON shape

```json
{
  "change": "compact-chat-density-and-layout-rubric",
  "viewport": "desktop|mobile-iphone-se",
  "story": "StoryName",
  "screenshots": [{ "path": "string" }],
  "metrics": {
    "asyncSurface": {
      "state": "empty-loading|empty-idle|ready-loading|ready-idle",
      "ownsScroll": false,
      "ownsBackground": false
    },
    "topHeader": {
      "heightPx": 0,
      "passiveSignals": 0,
      "workspaceTextVisible": "string|null",
      "fullPathVisible": false
    },
    "routeStatus": {
      "visible": true,
      "placement": "header-trailing|route-toolbar",
      "duplicateBodyStatus": false
    },
    "passiveDisclosures": {
      "metadataAlignedWithTabs": false,
      "standaloneRow": false
    },
    "composer": {
      "actionRowHeightPx": 0,
      "statusRowHeightPx": 0,
      "secondaryLabelsCollapsed": false,
      "helpCollapsedToQuestionMark": false
    },
    "layout": {
      "horizontalOverflow": false,
      "stackedSurfaceCountAboveConversation": 0
    }
  }
}
```

## Minimum Review Evidence

- One desktop screenshot.
- One compact screenshot at iPhone SE width.
- DOM metrics for header height, async-surface state ownership, passive disclosure placement, composer row heights, and compact-collapse states.
- Storybook DOM assertions that verify the contract, not a single magic pixel snapshot.

## Delivery Order and Gate

Use this order for Chat/Shell layout work:

1. Add or update primitive stories and DOM tests for any changed leaf layout component.
2. Add or update composite stories that assemble those primitives.
3. Add or update route assembly stories for the real first viewport.
4. Only then wire the change into the page/app shell.

For the current Chat/Shell contract, the minimum primitive gate covers:
- `AsyncSurface`
- `AdaptiveIconButton`
- `SurfaceSignalDisclosure`
- `StatusSignal`
- `SessionStatusPillMenu`
- `ComposerActionBar`
- `ComposerStatusBar`

Composite and route stories do not replace primitive coverage. If the leaf contract changes, the leaf story must change first.
