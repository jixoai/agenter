## Why

Descriptor-backed runtime CLI already has one unified JSON transport surface, but it still forces AI callers to repeat field names even when the schema is rigid and machine-readable. A compact positional mode can reduce token cost for customers without introducing a parallel ad-hoc command family.

## What Changes

- Add a unified `--compact` input mode to all descriptor-backed runtime CLI subcommands.
- Derive compact positional codecs, field-index help, and recommendation hints directly from the shared descriptor schema.
- Keep standard object JSON as the canonical form while letting compact arrays decode back into the same validated descriptor payload.
- Teach compact mode independently in each system skill and runtime prompt surface without centralizing those skill docs.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `runtime-json-tool-descriptor-surface`: descriptor-backed runtime CLI gains a second schema-derived compact array encoding, schema-derived compact help, and explicit `--compact` parsing.
- `runtime-skills-cli-surface`: runtime skills and prompts teach `--compact` as an optional per-command encoding surface while keeping each system skill independent.

## Impact

- Affected code: `packages/app-server/src/runtime-tool-descriptors.ts`, `packages/app-server/src/runtime-cli.ts`, runtime CLI tests, built-in skill markdown, and runtime prompt sources.
- Affected behavior: `attention|message|workspace|terminal <subcommand> --help` output, runtime CLI parsing, and system-skill guidance.
- No runtime-local API route shape changes are intended.
