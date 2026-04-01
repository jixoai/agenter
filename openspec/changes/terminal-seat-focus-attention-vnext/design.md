## Architecture Notes

### 1. Separate inspection selection from focus truth

- WebUI needs a local "currently inspected terminal tab" state so the user can browse terminals.
- Terminal-system owns a separate actor-scoped focus set that determines who is actually following which terminals.
- Selecting a tab must not implicitly mutate terminal focus.

### 2. Focus is a per-actor seat capability

- Focus or unfocus belongs to an actor seat and therefore must be executed with that actor's terminal credential.
- The Users panel becomes the place where focus state is managed because it already carries seat, permission, and credential semantics.
- The top toolbar may keep terminal-local presentation controls, but not collaboration focus mutation.
- When WebUI is opened by a superadmin operator, a selected seat token still defines who performed terminal focus, read, or write. The operator chrome must not silently rewrite seat-scoped activity back into a superadmin action.

### 3. Runtime only consumes its own actor focus

- SessionRuntime should only translate the focused terminal ids owned by its own terminal actor into attention invalidation and read behavior.
- Human actors or other avatars may focus the same terminal, but those focus states are terminal-system truth, not implicit inputs into this runtime's LoopBus.
- This preserves orthogonality:
  - terminal-system owns focus truth
  - app-server runtime consumes focus via an adapter for one session actor
  - attention remains a runtime concern, not a terminal-system concern

### 4. Multi-actor focus is valid

- More than one actor may focus the same terminal.
- One actor may focus more than one terminal.
- The control plane and UI must expose this without degrading back to a single global `focused` flag.

### 5. Admin and bootstrap flows must respect actor focus ownership

- Terminal creation may still offer a convenience "focus after create" option, but that option must target the caller actor explicitly.
- Global superadmin administration may inspect and repair focus-bearing seats, but it does not become the default focus owner merely because it created or edited the terminal.

## Verification Slice

This change owns the terminal collaboration and focus-to-attention slice of the BDD matrix.

### Required scenarios

- Terminal creation, grants, and collaboration seats: scenarios `51-65`
- Terminal focus and attention ingestion: scenarios `66-75`
- Mixed room/terminal credential and recovery boundaries that exercise orthogonality: scenarios `78`, `80-83`, `85`, `90-95`, `100`

### Required evidence modes

- terminal-system and app-server integration coverage for actor-scoped focus truth and runtime ingestion
- WebUI browser coverage for per-seat focus controls on desktop and mobile
- real-model or mixed-real-AI coverage for the terminal-assisted scenarios whenever credentials are available, with explicit skip status otherwise
