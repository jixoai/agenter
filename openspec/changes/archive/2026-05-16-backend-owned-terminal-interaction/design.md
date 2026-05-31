## Context

The current cli-shell repair path already established one important law: terminal-2 is the final composed app screen and projection hosts should render backend-authored cells. However, recent native acceptance showed another layer still violates the same principle: terminal-like interactions are still partly owned by the OpenTUI projection layer.

The strongest concrete evidence is in three places:

- Ghostty upstream terminal core already has native selection APIs and tests proving selection follows scrolling.
- The current `@termless/ghostty-native` wrapper exposes cells, viewport, cursor, scrollback, and scrolling, but not selection/copy/semantic selection APIs.
- `packages/cli-shell/src/tui/backend-frame-renderable.ts` currently owns `#selection`, `#dragSelection`, `#semanticSelection`, selected-text extraction, and semantic click selection.

That split explains the observed failures:

- a selected range can stay at screen coordinates after content scrolls because the projection layer owns the range;
- cursor-follow can miss because frontend code tries to compute viewport target from a recent frame instead of asking backend truth to follow its cursor;
- double/triple click semantics drift because the projection layer reimplements terminal selection behavior with partial local text snapshots;
- dialogue selection/copy/wrap/cursor keeps becoming a separate algorithm unless it goes through the same backend interaction law.

The durable repair is to make terminal interaction ownership a backend/offscreen-renderer capability. OpenTUI remains valuable, but its role is event capture, focus/click primitive ownership, scrollbar control projection, and frame drawing. It is not the owner of scrollback selection truth.

## Goals / Non-Goals

**Goals:**

- Define backend-owned selection, copy, semantic selection, cursor-follow, and interaction overlay contracts.
- Expose Ghostty-native terminal core selection where available instead of simulating it in OpenTUI.
- Preserve one selection truth per owner region: shell selection belongs to shell backend/offscreen renderer; dialogue selection belongs to terminal-chat backend/offscreen renderer.
- Make host events route objectively to the owning backend region.
- Make frame payloads able to carry backend-provided selection overlays and cursor facts for projection rendering.
- Remove or neutralize host-local OpenTUI selection state as a durable truth source.
- Keep double/triple click clustering strict enough to match real terminal expectations: same owner, same backend row, x drift at most one terminal cell.
- Keep `--debug` filters useful for manual acceptance by tracing event owner, backend action, selected range, cursor-follow request, and backend viewport result.

**Non-Goals:**

- Do not promote `ghostty-native` to the default backend.
- Do not replace the existing terminal-2 composition law.
- Do not require Web to implement a second independent protocol-2 decoder for cli-shell; Web still renders terminal-2 through its existing terminal projection path.
- Do not build a no-backend dialogue optimization in this change.
- Do not treat native Ghostty.app automation as required acceptance; the user remains the manual native tester.
- Do not keep OpenTUI selection simulation as the default behavior once backend interaction capabilities are available.

## Decisions

### 1. Backend interaction is a platform capability, not cli-shell app policy

Add a `terminal-backend-interaction` capability that defines common terms and contracts:

- `TerminalInteractionCapabilities`
- `TerminalSelectionRange`
- `TerminalSelectionOverlay`
- `TerminalPointerEvent`
- `TerminalSemanticSelectionKind`
- `copySelection`
- `clearSelection`
- `selectRange`
- `selectWordAt`
- `selectLineAt`
- `startSelection`
- `updateSelection`
- `endSelection`
- `followCursor`

Rationale:

- cli-shell is only one consumer. The same interaction law is needed by shell projection, terminal-chat, future terminal-view surfaces, and runtime inspection.
- A app-local recommendation map cannot be the owner of terminal physics.

Rejected alternative:

- Keep interaction enhancements in `@agenter/cli-shell`.
  - Rejected because it recreates backend semantics in a host app and causes the current regression class.

### 2. Ghostty-native should expose terminal-core selection first

The first backend implementation should expose the selection APIs already present in Ghostty terminal core:

- set/clear selection through tracked `Screen.Selection`;
- word selection through `Screen.selectWord`;
- line selection through `Screen.selectLine`;
- selected text through `Screen.selectionString`;
- selection overlay/range through selection pins converted to screen/viewport coordinates.

Rationale:

- Ghostty already solves the hardest selection problem: tracked pins move with scrollback and screen mutation.
- Using the backend-native model removes our need to keep screen-row snapshots inside OpenTUI.

Rejected alternative:

- Reuse Ghostty `Surface.zig` wholesale.
  - Rejected for MVP because the current wrapper uses `lib_vt.zig`/terminal core, not the full UI surface. The terminal core already exposes enough APIs for the first backend-owned selection contract.

### 3. Generic backend interaction adapter is required for non-Ghostty owners

Backends that do not expose native selection may use a backend interaction adapter, but that adapter still lives behind the backend/offscreen-renderer contract and owns selection state in backend coordinates.

Rationale:

- Dialogue/terminal-chat needs the same observable behavior even if it is not a Ghostty terminal.
- The user explicitly prefers an independent backend first because it reuses and hardens the offscreen renderer law.

Rejected alternative:

- Put dialogue selection in terminal-2 or host OpenTUI code.
  - Rejected because it hand-rolls a second algorithm and bypasses the shared interaction law.

### 4. OpenTUI projection may capture events but not own terminal selection truth

OpenTUI projection components may:

- receive mouse, drag, wheel, key, paste, resize, focus, and copy events;
- map local coordinates to an owner region and backend coordinates;
- send semantic events to the backend;
- render backend-provided cells, cursor, selection overlay, focus projection, and scrollbar projection;
- use OpenTUI scrollbar/focus/click primitives as native control projections.

OpenTUI projection components must not:

- keep durable selected text as host-local state;
- compute scrollback selection ranges from OpenTUI `Selection` as a terminal truth;
- keep word/row semantic selection as a app-local copy algorithm;
- update selection visuals without a backend-published overlay.

Rationale:

- This keeps OpenTUI in its correct layer: native controls and drawing, not terminal semantic ownership.

### 5. Cursor-follow is a backend command, not a frontend viewport calculation

The input path should send terminal input bytes, then request backend cursor follow if input was accepted. The backend decides the viewport result from its current cursor and scrollback truth and republishes a frame.

Rationale:

- Frontend frame state may be stale by one or more frames.
- Backend already owns cursor and viewport.

Rejected alternative:

- Frontend computes `viewportTarget` from `cursor.absY`.
  - Rejected as a fallback-only diagnostic path because it has already failed under native acceptance and violates single source of truth.

### 6. Semantic click clustering is an interaction event rule, not selected-text extraction

The projection layer may classify a click sequence before sending `selectWordAt` or `selectLineAt`, but the classification must be strictly bounded:

- same owner;
- same backend row;
- same mouse button;
- time within configured terminal click interval;
- x drift at most one terminal cell;
- y drift must not cross a terminal row.

The selected word/line itself belongs to the backend/offscreen renderer.

Rationale:

- Click grouping depends on host event delivery, but selection semantics depend on backend text/cell truth.

### 7. Transport and direct mode share high-level terminal interaction functions

The transport boundary should expose high-level functions such as:

- `sendInteractionEvent(...)`;
- `copySelection(...)`;
- `clearSelection(...)`;
- `followCursor(...)`;
- `pullFrame(...)` returning cells plus selection overlays.

Direct in-process mode should pass structured objects or fast clones instead of JSON serialization. WebSocket mode may serialize using protobuf/structured protocol frames.

Rationale:

- The same API prevents native direct mode and Web mode from drifting.
- Serialization is a transport concern, not a caller concern.

## Risks / Trade-offs

- **Risk: Ghostty terminal core APIs are lower-level than Surface mouse handling.**  
  Mitigation: expose only minimal tracked selection APIs first; defer full Surface behavior such as URL selection, selection clipboard policy, and selection-scroll timers unless tests prove they are needed for MVP.

- **Risk: xterm backend may not provide equivalent native selection.**  
  Mitigation: add a backend interaction adapter that owns selection in backend coordinates and mark capability facts explicitly. Do not pretend it is Ghostty-native selection.

- **Risk: selection overlay serialization can add per-frame cost.**  
  Mitigation: publish compact row-range overlays only when selection exists, and cache/encode by row like existing frame row caching.

- **Risk: removing OpenTUI selection too quickly could temporarily lose copy.**  
  Mitigation: implement backend copy path before deleting host-local selection copy, then remove the host-local path once tests prove backend copy works.

- **Risk: dialogue independent backend increases implementation scope.**  
  Mitigation: keep it as a required path for acceptance but sequence it after shell backend-owned selection is proven, reusing the same event bridge and renderable.

## Migration Plan

1. Add OpenSpec tests and type contracts for backend-owned interaction before implementation.
2. Add backend interaction types in `@termless/core` and expose capability facts.
3. Expose Ghostty-native selection APIs in Zig/TS wrapper and cover them with native/backend tests.
4. Thread backend selection/copy/follow APIs through terminal-system and terminal-transport-protocol.
5. Update cli-shell projection components so OpenTUI captures events and renders backend overlays only.
6. Move double/triple click selection to backend interaction event routing.
7. Add dialogue backend event bridge using the same contract.
8. Remove or quarantine host-local selection simulation code.
9. Run automated BDD tests and prepare `.chat/backend-owned-terminal-interaction/` manual acceptance tasks in plain language.

Rollback strategy:

- Keep backend interaction additions additive until cli-shell routing is switched.
- If a backend selection API fails, disable only that backend capability and route to the backend interaction adapter, not to OpenTUI-local truth.

## Open Questions

- Does the first Ghostty-native MVP need selection scrolling while dragging outside the viewport, or can that wait until after stable in-viewport selection/copy passes?
- Should `selectWordAt` use Ghostty's `selection_word_chars` behavior for shell and ICU `Intl.Segmenter` only for backend adapters, or should the shared adapter expose an explicit word-boundary strategy per owner?
- Should Option+Left/Right be implemented as shell-native escape sequences where possible, with ICU-based fallback only for backends that cannot supply native word movement?
