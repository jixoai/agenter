## Context

Tool invocation rendering is split across chat markdown, cycle execution cards, and panel-specific custom blocks. The same invocation can appear with different status wording and different payload viewers.

## Goals / Non-Goals

**Goals**
- Define one explicit invocation lifecycle model for technical UI.
- Reuse one card component across Devtools/Terminal/Model technical surfaces.
- Keep payload visualization YAML-first via existing JSONViewer modes.
- Keep Chat transcript free of tooling records.

**Non-Goals**
- Rebuild provider-side raw protocol dumps.
- Introduce a new markdown-tool protocol.
- Preserve legacy panel-local tool card variants.

## Decisions

### Canonical UI model: `ToolInvocationView`

All technical panels map raw runtime facts to:

- `invocationId: string`
- `toolName: string`
- `status: "waiting" | "running" | "success" | "failed" | "cancelled"`
- `call: unknown | null`
- `result: unknown | null`
- `error: string | null`
- `meta: Record<string, unknown>`
- `startedAt?: number`
- `finishedAt?: number`

This model is panel-agnostic and makes status semantics explicit.

### One renderer: `ToolInvocationCard`

The new component owns:

- status icon + status label
- optional call/result sections
- error section for failed/cancelled cases
- YAML-first payload rendering via `JSONViewer`

No panel can render tool invocation payloads with custom markdown blocks anymore.

### Adapter layer per panel

Each panel converts its local source to `ToolInvocationView`:

- Cycle detail: pair `tool_call` / `tool_result`
- Terminal activity: map tool-related activity rows (including legacy yaml tool fences as backward-compatible read-only parsing)
- Model panel: map invocation-like transport/tool execution facts

Adapters stay local; rendering stays shared.

## Risks / Trade-offs

- Some historical rows may have incomplete call/result payloads. Shared card must support partial records.
- Model panel data may not always represent executable invocations. Adapters should only map true invocation records.
- Empty-string payloads should be treated as absent to avoid noisy `"\"\""` previews.

## Migration Plan

1. Add shared `ToolInvocationCard` + typed status contract.
2. Replace cycle detail tool trace UI with the shared card.
3. Replace terminal/model tool lifecycle sections with the shared card where applicable.
4. Delete dead panel-local tool rendering branches.
5. Add Storybook DOM coverage for major invocation states.
