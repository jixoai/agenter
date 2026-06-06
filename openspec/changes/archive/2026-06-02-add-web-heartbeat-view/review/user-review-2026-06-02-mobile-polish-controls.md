# User Review Loop: Mobile Heartbeat Polish Controls

## User Findings

- Use `agent-browser` in headless mobile size to inspect style problems.
- Heartbeat detail had horizontal overflow.
- Heartbeat detail needed an explicit `scrollToBottom` capability.
- `configable` mode needed runtime lifecycle controls such as start/pause.
- Top `Subnavbar` title needed smaller typography and should carry the runtime controls.

## Corrections

- Added package-level `HeartbeatRuntimeActions` and optional `startRuntime` / `stopRuntime` connection capabilities.
- The example adapter wires those capabilities to existing client-sdk `startSession` / `stopSession`; no backend endpoint was added or reshaped.
- Added a shared Framework7 `HeartbeatPageSubnavbar` that renders a small truncated status title plus icon-only controls for scroll-to-bottom and runtime start/stop.
- Kept Compact and Config as icon-only `Link` actions inside the official bottom `Toolbar position="bottom"` so status stays in the top chrome and actions stay in the bottom toolbar.
- Replaced the config editor with an official Framework7 modal `Sheet` using `Toolbar` and `PageContent` as its sheet structure.
- Routed Compact through the official Framework7 `dialog.confirm` flow before invoking the adapter action.
- Restored the Framework7 `PageContent` as the vertical scroll owner and constrained Heartbeat stream/group/entry/custom-element hosts to prevent mobile intrinsic-width blowout.
- Did not click the live backend Stop control during browser verification to avoid stopping the user's running Default Avatar; mocked BDD coverage verifies start/stop callbacks.

## Evidence

- Before mobile detail metric: current `PageContent` horizontal overflow was `scrollWidth=1126`, `clientWidth=390`.
- After mobile detail metric from `agent-browser`: Heartbeat `PageContent` is `scrollWidth=390`, `clientWidth=390`, `scrollHeight=19110`, `clientHeight=664`.
- After `Scroll to bottom`: `scrollTop` reached `18446`, equal to the current max.
- Subnavbar status title font measured `11.5px` and controls were `Scroll to bottom` and `Stop runtime`.
- Bottom toolbar remained `role="toolbar"` with icon-only `Request compact` and `Configure next call` action links.
- Final Framework7 topology metric: `toolbar toolbar-bottom`, config `sheet-modal`, config sheet has its own `Toolbar` and `PageContent`, and Compact dialog was `.dialog.modal-in` with `Cancel` / `OK`.
- Final mobile metric after this correction: Heartbeat `PageContent` stayed `scrollWidth=390`, `clientWidth=390`; scroll-to-bottom reached `scrollTop=max=20245`.
- Screenshot: `.screenshot/web-heartbeat-view/agent-mobile-heartbeat-after-polish-clean.png`.
- Screenshots: `.screenshot/web-heartbeat-view/agent-mobile-f7-final-main.png`, `.screenshot/web-heartbeat-view/agent-mobile-f7-config-sheet-final.png`, `.screenshot/web-heartbeat-view/agent-mobile-f7-compact-confirm-final.png`.
- Verification commands passed after the correction.

## Follow-up

- The current client-sdk public lifecycle surface exposes start/stop. A true pause action is visible in lower-level runtime internals but is not a public SDK/router capability in this first package loop; adding it should be discussed before tasks are expanded.
