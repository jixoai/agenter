## Context

Two different responsibilities are currently conflated:

- the shared workbench chrome should only define switched-window structure and fixed chrome slots
- each page should decide how to spend the toolbar slot it receives

`WorkbenchToolbar` currently violates that separation by deciding row count and height. Room then inherits that policy and cannot compress into the fixed high-density operator header the product now requires.

On the data side, room attachment upload and retrieval already exist, but the product still lacks a durable list/read path for "all assets currently owned by this room", which blocks the new `assets` pane.

## Decisions

1. **Fix `workbench-page-toolbar` at 48px**
   - `WorkbenchWindow` owns the chrome slot height.
   - The slot does not grow based on page content.

2. **Keep `WorkbenchToolbar` as a stateful viewport wrapper, not a layout engine**
   - It provides container query styling hooks and JS responsive state.
   - It no longer owns `rows`, `fixed`, or lower-rail semantics.
   - It may keep legacy structured regions for compatibility, but it must also allow fully custom page-owned content.

3. **Room owns its own dense toolbar layout**
   - Room will render:
     - `icon left_title right_actions`
     - `icon chips chips`
   - `icon` shows the current `View as` user avatar.
   - `left_title` shows the current `View as` user label.
   - `right_actions` are `search-messages`, `add-user`, `manage`.
   - second-row chips are `chat` and `assets`.

4. **`page_content` remains a pure body-stage**
   - For Room, the body shows exactly one content mode:
     - `chat`: shared `web-chat-view`
     - `assets`: room asset list
   - No extra room header or subheader is allowed inside `page_content`.

5. **Add a room asset listing control plane**
   - Persist uploader identity on newly uploaded room assets.
   - Expose a TRPC query + client-sdk cached resource for listing all assets belonging to a room.
   - Older assets without uploader truth may project `unknown`.

6. **Search action is local transcript search**
   - This change does not introduce backend full-text search.
   - The search action operates on currently loaded room messages and uses transcript row anchors for navigation.

## Risks / Trade-offs

- Existing toolbar stories and terminal toolbar usage assume the shared primitive can grow. Mitigation: keep backward-compatible slot APIs while forcing the fixed chrome height at the window level.
- Room asset uploader identity is not available for historical uploads. Mitigation: make uploader optional/durable going forward and render a stable fallback for older records.
- Local transcript search only covers loaded messages, not all historical pages. Mitigation: label the interaction as message search within the current loaded transcript scope for now; do not fake server-side search.
