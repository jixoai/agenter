## 1. Durable root-workspace shell world

- [x] 1.1 Introduce a session-owned `root-workspace` shell world abstraction around one durable `just-bash` instance, its shared filesystem, and its root-exclusive command surface.
- [x] 1.2 Wire `SessionRuntime` to lazily create and reuse that durable root shell world for `root_bash`, and delete the legacy per-call root-workspace `Bash` construction path.

## 2. Dynamic authority refresh

- [x] 2.1 Sync mounted workspaces, grants, hidden paths, and runtime skill mount roots into the durable root shell world without rebuilding the host shell.
- [x] 2.2 Keep `root-workspace`, `public-workspace`, and `terminal` env/CLI semantics explicit in code comments and implementation boundaries.
- [x] 2.3 Serialize root-world refresh and execution so concurrent `root_bash` calls cannot corrupt shared shell state.

## 3. Regression coverage

- [x] 3.1 Add focused tests for durable root-world exec isolation versus shared filesystem persistence.
- [x] 3.2 Add focused tests for dynamic mount add/remove and overlay rule refresh on the same durable root shell world.
- [x] 3.3 Run targeted app-server tests and update any durable spec/comment surfaces needed to prevent regression.
