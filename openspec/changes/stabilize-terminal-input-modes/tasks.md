## 1. OpenSpec and durable contracts

- [x] 1.1 Add the `terminal-input-modes` capability spec and update related runtime/terminal specs for raw vs mixed terminal input law
- [x] 1.2 Sync durable package specs so terminal-core and runtime tool contracts describe the stabilized dual-channel input architecture

## 2. Terminal core implementation

- [x] 2.1 Replace legacy pending suffix handling with explicit `.raw.txt` / `.mixed.txt` dispatch and make automation-facing input flow authoritative through pending files
- [x] 2.2 Add `<raw>...</raw>` support to mixed input parsing, including fixed HTML entity decoding and parse-failure behavior
- [x] 2.3 Keep `writeRaw(...)` as the interactive-only forwarding path and document the boundary with precise comments

## 3. Runtime and control-plane surfaces

- [x] 3.1 Split raw write and mixed input across terminal control-plane, runtime-local descriptors, and global terminal APIs
- [x] 3.2 Update help text, runtime skill discovery, and terminal skill references so AI learns when to use raw vs mixed

## 4. Verification

- [x] 4.1 Add or update terminal-system BDD tests for mixed/raw pending files, raw blocks, and queue/wait semantics
- [x] 4.2 Add or update app-server and client-sdk BDD tests for `terminal write` raw mode, `terminal input` mixed mode, and skill/help guidance
