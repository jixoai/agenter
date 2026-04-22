# 2026-04-23 Terminal input failure truth self-review

## Objective facts

- Self-review found two concrete issues after the initial terminal-input-modes landing:
  - nested `<raw>` blocks were not rejected; parser would partially consume the outer raw block and leak a trailing `</raw>` as plain text
  - even when terminal-core rejected a pending mixed payload, `TerminalControlPlane.input(...)` still returned `{ ok: true, message: "written" }`
- Both issues were reproduced with direct local commands before patching:
  - `parseMixedInput("<raw>a<raw>b</raw>c</raw>")`
  - `TerminalControlPlane.input({ text: "<raw>a<raw>b</raw>c</raw>", ... })`

## Spec truth added

- `openspec/specs/terminal-input-modes/spec.md`
  - nested raw blocks must be rejected
  - pending processing failures must surface back to automation callers
- `openspec/specs/runtime-json-tool-descriptor-surface/spec.md`
  - descriptor-backed terminal write/input must not synthesize success when terminal-core rejects pending input
- durable package specs updated in:
  - `packages/terminal-system/SPEC.md`
  - `packages/app-server/SPEC.md`

## Implementation changes

- `packages/terminal-system/src/input-parser.ts`
  - raw block parsing now rejects nested `<raw>` before the matching close tag
- `packages/terminal-system/src/agentic-terminal.ts`
  - `write()` / `input()` now return the real `TerminalPendingInputResult`
- `packages/terminal-system/src/managed-terminal.ts`
  - preserves that pending result instead of erasing it
- `packages/terminal-system/src/terminal-control-plane.ts`
  - pending rejection now returns `ok: false`
  - no synthetic `terminal_write` event is appended when PTY input never happened
- `packages/terminal-system/skills/terminal/references/input-modes.md`
  - documents nested `<raw>` as a hard parse error and tells AI to encode literal `<raw>` as `&lt;raw&gt;`

## Regression coverage

- `bun test packages/terminal-system/test/input-parser.test.ts packages/terminal-system/test/integration.test.ts packages/terminal-system/test/control-plane.test.ts packages/app-server/test/trpc-router.test.ts`
  - pass
- Added coverage:
  - parser rejects nested raw blocks
  - `AgenticTerminal` moves nested-raw pending files into `input/failed`
  - `TerminalControlPlane` returns failure truth and emits no synthetic write fact
  - app-server TRPC terminal route preserves the same failure truth

## Real walkthrough evidence

- Ran a real `TerminalControlPlane` script against a live `cat` PTY:
  - raw payload preserved literal `<key data=\"enter\"/>`
  - mixed payload preserved literal `<key data=\"enter\"/>` inside `<raw>...</raw>`
  - rejected nested raw returned:
    - `ok: false`
    - `message: "Terminal input failed before reaching the PTY (input-processing-failed)"`
  - activity log contained only two `terminal_write` facts:
    - one `mode: raw`
    - one `mode: mixed`
  - no synthetic fact was recorded for the rejected payload
