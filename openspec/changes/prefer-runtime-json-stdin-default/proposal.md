## Why

The runtime CLI already supports JSON stdin, but the official help and skill guidance still leave too much room for heredoc- or argv-heavy habits. That causes the model to choose noisier shell forms by imitation and increases avoidable encoding failures for multi-line or non-ASCII room payloads.

## What Changes

- Prefer `root_workspace_bash` with a minimal `command` plus JSON `stdin` as the canonical guidance surface for descriptor-backed runtime CLI commands.
- Reorder descriptor-backed `--help` examples so stdin is shown first and argv is explicitly framed as a compact fallback for trivially short payloads.
- Update built-in runtime skills and top-level prompts to teach the same default JSON-stdin rule consistently across `message`, `terminal`, and `attention`.
- Preserve UTF-8 JSON payloads across runtime CLI parsing when shell transport round-trips otherwise turn non-ASCII text into mojibake before JSON decode.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `runtime-json-tool-descriptor-surface`: help output and JSON parsing rules now prefer `command + stdin`, keep argv as a secondary compact form, and preserve UTF-8 payload fidelity.
- `runtime-skills-cli-surface`: built-in skills and runtime prompt guidance now teach JSON stdin as the default shell form for runtime-local CLI commands.

## Impact

- Affected code: `packages/app-server/src/runtime-tool-descriptors.ts`, runtime CLI tests, built-in skill markdown, and runtime prompt sources.
- Affected behavior: `message|terminal|attention --help` example ordering, runtime CLI JSON parsing robustness, and AI-facing shell guidance.
- No transport schema or runtime-local API route changes are intended.
