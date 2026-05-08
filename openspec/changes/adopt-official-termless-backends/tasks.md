## 1. Boundary Reset

- [x] 1.1 Audit production imports, package dependencies, tests, and docs that still reference `@agenter/termless-xterm-backend`
- [x] 1.2 Replace production backend authority imports with official Termless backend entrypoints such as `@termless/xtermjs`
- [x] 1.3 Update dependency-boundary tests so Agenter-private backend ownership fails fast

## 2. Consumer Bridge Migration

- [x] 2.1 Rework `terminal-system` bridge code to wrap official Termless backends without publishing a new backend authority
- [x] 2.2 Rework `cli-shell` live terminal mirror to consume the migrated bridge and preserve current read/write behavior
- [x] 2.3 Remove or finish collapsing `packages/termless-xterm-backend` so it no longer teaches the wrong platform law

## 3. Runtime And View Contract Alignment

- [x] 3.1 Update runtime terminal config/projection surfaces so backend launch truth stays separate from browser renderer facts
- [x] 3.2 Update terminal renderer and `terminal-view` integration code to stay backend-neutral while keeping desktop `auto -> xterm`
- [x] 3.3 Sync terminal docs and durable specs that currently describe Agenter-private backend ownership

## 4. Verification

- [x] 4.1 Run focused terminal package tests covering `terminal-system`, `cli-shell`, and `terminal-view`
- [x] 4.2 Verify `bun agenter shell` still supports real input/output, colors, cursor, and scroll behavior after the migration
- [x] 4.3 Verify real browser `terminal-view` attach/reconnect still works with the corrected backend boundary and xterm default

## 5. Delivery Discipline

- [x] 5.1 Update this task list together with each implementation commit so progress remains factual
- [x] 5.2 Keep backend ownership refactor separate from any future `ghostty-native` promotion work
- [ ] 5.3 Archive the change only after durable specs are synced and all verification evidence is complete
