## Context

Runtime descriptor help, parsing, and guidance already flow from one shared descriptor registry. That gives us a stable platform surface for adding a second encoding without creating one-off per-command glue. The compact mode must remain descriptor-derived, explicit, and reversible back into the same object payload that the runtime-local API already validates.

## Goals / Non-Goals

**Goals:**

- Add one explicit `--compact` mode across all descriptor-backed runtime CLI commands.
- Derive compact encode/decode/help metadata from the descriptor schema instead of hand-writing per-command layouts.
- Keep standard object JSON and compact JSON arrays interoperable with the same handler and validation path.
- Surface compact hints independently through each system skill and top-level runtime prompts.

**Non-Goals:**

- Do not add a standalone `compactjson` helper command in v1.
- Do not auto-detect compact arrays without `--compact`.
- Do not change runtime-local HTTP request bodies or descriptor handler signatures.
- Do not extend compact mode to `tool <file>` or non-descriptor helper scripts.

## Decisions

### Decision: Compact mode is an explicit CLI marker

Compact mode will be enabled only by `--compact`. The payload remains one JSON source, but object mode still expects a JSON object and compact mode expects a JSON array.

Why:

- It keeps CLI semantics predictable.
- It avoids accidental ambiguity with ordinary JSON arrays.
- It preserves `--help` / parsing law as a deliberate descriptor-level contract.

### Decision: Compact metadata is schema-derived through JSON Schema

We will derive compact layout metadata from `toJSONSchema(descriptor.inputSchema)` rather than from command-specific manual definitions.

Why:

- Help output and parser rules stay tied to the same descriptor source.
- The implementation can reuse the same derived metadata for decode, example rendering, and recommendation hints.
- Zod refinement logic remains intact because compact arrays decode back into ordinary object payloads before `inputSchema.parse(...)`.

### Decision: Compact codec uses one recursive law

The codec rules are:

- fixed object -> positional array by property order
- nested object -> recurse and restart indexes inside that object
- array -> recurse per element
- optional fields -> trailing omission allowed; interior holes require `null`
- enum -> numeric index by declared enum order
- discriminated union -> keep the original discriminator literal in element `0`
- record/dynamic keys -> `[[key, value], ...]` with recursive value encoding
- const field outside enum -> raw literal value

Why:

- This matches the requested “fully recursive but AI-readable” law.
- It keeps union branches understandable without forcing AI to memorize variant numbers.
- Dynamic-key records remain compact without losing key identity.

### Decision: Help computes recommendation strength from top-level complexity only

Help will print `Compact: Suggested` or `Compact: Available` using a top-level heuristic. It will not print negative language.

Why:

- The recommendation must be automatic and stable.
- The user explicitly wants presence without discouragement.
- Top-level complexity is the closest proxy to actual caller effort.

## Risks / Trade-offs

- [JSON Schema derivation misses an unsupported node shape] -> Restrict v1 to the descriptor schema shapes already present in runtime descriptors and fail loudly for unsupported future shapes.
- [Compact help becomes noisy] -> Keep the schema-derived field index view concise and example-first; avoid repeating full object help prose inside compact sections.
- [Enum number mapping can drift if declaration order changes] -> Make help print the mapping directly and derive it from the same schema every time.
- [Dynamic-key record arrays are less obvious to humans] -> Explain the `[[key, value], ...]` law in help and skills, and keep standard JSON always available.

## Migration Plan

1. Add OpenSpec deltas for descriptor compact mode and skill/prompt guidance.
2. Introduce a compact-schema derivation module plus parser/help rendering.
3. Teach runtime CLI to reserve `--compact` and parse compact payloads.
4. Update skill/prompt guidance and regenerate built-in skill catalog.
5. Run targeted CLI, root-bash, and guidance regression tests.
6. Archive the change and sync durable specs.

## Open Questions

- None for v1. The explicit `--compact`, fully recursive codec, and no-version payload law are fixed by this change.
