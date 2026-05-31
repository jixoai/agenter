## Context

The existing terminal window surface already separates PTY geometry from projection geometry, but the window chrome still leaks several conflicting concerns:

- titlebar controls currently encode the wrong actions and the wrong visual primitive
- titlebar inline-end still shows multiple chips instead of the one stable geometry fact the user wants
- cover mode still behaves like a framed window instead of a fullscreen-like shell state
- destructive delete is still coupled to the titlebar, which conflicts with the final two-circle control law

The durable rule is that `terminal-view` remains a viewport primitive while the host owns app chrome. This design keeps that split and tightens the host-side projection law.

## Goals / Non-Goals

**Goals:**
- Make `fit` and `cover` explicit host projection modes with stable geometry semantics.
- Keep titlebar height compact and unscaled while only terminal content scales in `fit`.
- Constrain titlebar controls to two macOS-style circular state primitives.
- Show only terminal size information on the titlebar inline-end.
- Preserve live resize as a frame-derived PTY resize path and disable it in frameless `cover`.
- Preserve terminal deletion as a separate destructive route action.

**Non-Goals:**
- Redesign the route-level workbench toolbar or users/actions workflow.
- Introduce a new terminal-statusbar component.
- Change PTY transport, snapshot hydration, or terminal-view rendering ownership.
- Archive the change automatically as part of this implementation step.

## Decisions

### 1. Host chrome stays host-owned; terminal-view remains a viewport primitive

`terminal-view` continues to render only the terminal viewport. The titlebar, projection mode controls, sticky fullscreen chrome, and resize affordance remain in `terminal-window-surface`.

Why:
- This preserves the existing platform law that app chrome does not leak into the shared terminal viewport primitive.

Alternative considered:
- Push titlebar and projection semantics into `terminal-view`.
- Rejected because it couples app chrome to a reusable terminal viewport primitive and breaks the current host/component boundary.

### 2. `fit` scales only terminal content; `cover` removes the frame and keeps native content scale

The projection helper continues to derive shell/body sizes from terminal screen metrics, but the host surface now renders two distinct shell states:

- `fit`: framed window, compact titlebar, resize handle, scaled terminal content, titlebar unchanged
- `cover`: frameless shell, sticky titlebar, no resize handle, native-scale terminal content, outer viewport scrolling

Why:
- This matches the user’s final geometry law and prevents transform-driven titlebar distortion.

Alternative considered:
- Keep one framed shell and vary only scale/scroll behavior.
- Rejected because it cannot express the fullscreen-like cover state cleanly and keeps the wrong resize affordance alive.

### 3. Titlebar controls become two state circles, not action buttons with icons or labels

The titlebar exposes exactly two circular controls:

- lifecycle state circle: blue `bootstrap` or red `kill`
- mode state circle: yellow `fit` or green `cover`

Each group projects only the current state as one visible circle. No icons or inline text are rendered inside the circles.

Why:
- This matches the final user-approved control primitive and avoids overloading the titlebar with mixed action types.

Alternative considered:
- Keep icon buttons or textual segmented controls.
- Rejected because both diverge from the macOS-like prototype the user explicitly approved.

### 4. Terminal deletion moves out of the titlebar

Deleting the terminal remains available, but it is triggered from route-level toolbar actions instead of the window titlebar.

Why:
- The titlebar contract only permits two current-state circles. A destructive delete control would introduce a third control category and break that law.

Alternative considered:
- Overload the red lifecycle circle to mean delete when stopped.
- Rejected because it conflates PTY lifecycle with catalog destruction.

### 5. Live resize sidebands are gesture-sourced, not reactive-effect-sourced

The resize handle may update local projection state while dragging, but transport-facing live resize sidebands must only be emitted from the explicit resize gesture lifecycle itself.

- drag move (`pointermove`) emits live resize for the current dragged frame
- drag end (`pointerup` / `pointercancel`) emits the final live resize commit
- reactive frame recalculation, viewport measurement, or unrelated state effects must not emit extra live resize sidebands

Why:
- This keeps the resize causality aligned with a named operator gesture instead of letting incidental local state churn masquerade as a resize action.

Alternative considered:
- Keep a generic `$effect` that emits whenever the derived frame dimensions change.
- Rejected because it allows non-gesture geometry churn to trigger resize notifications and breaks the user's explicit gesture-only trigger law.

## Risks / Trade-offs

- [Route-level delete affordance becomes less discoverable] → Keep the delete action explicit in the page toolbar and preserve the confirmation dialog.
- [Cover sticky titlebar may interact badly with scroll ownership] → Verify both Storybook DOM and Playwright route behavior on the shared stage scroll viewport.
- [Geometry assertions can regress if they depend on overly strict internal viewport equality] → Keep tests focused on host/body fit and user-visible shell behavior instead of shadow viewport internals.
- [Dropping non-pointer fallbacks may expose unsupported environments] → The terminal window surface already targets modern desktop/mobile browsers; using the Pointer Events path keeps the resize gesture model singular and testable.
