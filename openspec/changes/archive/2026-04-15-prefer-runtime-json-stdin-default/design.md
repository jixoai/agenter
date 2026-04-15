## Context

Descriptor-backed runtime CLI commands already share schemas and support both JSON argv and JSON stdin, but the AI-facing guidance is still inconsistent across three surfaces:

- descriptor-generated `--help`
- built-in runtime skills / references
- top-level runtime prompts

That inconsistency matters because the model learns by imitation. When help or skills show heredoc-heavy shell snippets first, the model tends to emit the same shape even when `root_workspace_bash` already offers a cleaner `command + stdin` transport. The result is more quoting noise, more token overhead, and a higher chance of transport-layer encoding corruption for non-ASCII payloads.

## Goals / Non-Goals

**Goals:**

- Make `root_workspace_bash.command + JSON stdin` the canonical AI-facing form for runtime-local CLI commands that take JSON payloads.
- Keep a compact single-argv JSON form available for trivially short payloads.
- Align descriptor help, built-in skills, and top-level prompts to the same rule.
- Preserve Unicode message content when runtime CLI parsing receives likely mojibake JSON produced by shell round-trips.

**Non-Goals:**

- Do not change the runtime-local HTTP routes or the descriptor registry shape.
- Do not introduce a new compact transport or field-indexed encoding in this change.
- Do not remove JSON argv support.

## Decisions

### Decision: Guidance changes stay descriptor- and skill-driven

We will update the descriptor examples, generated help text, built-in skill markdown, and global runtime prompts instead of adding a new central abstraction for JSON transport hints.

Why:

- The existing platform law already says skills are distributed by system.
- Descriptor help is already the canonical local self-help layer for CLI commands.
- A new parallel guidance registry would duplicate truth and reintroduce drift.

Alternative considered:

- Add a dedicated guidance registry for stdin-vs-argv recommendations.
  Rejected because it would create a second source of truth on top of descriptors and skills.

### Decision: Canonical help orders examples by transport preference

Descriptor-backed `--help` will sort examples so stdin appears before argv, and the rendered copy will explicitly label argv as the compact form for trivially short payloads.

Why:

- The model follows the first high-signal example.
- We want the compact argv form to remain available without presenting it as the default.

Alternative considered:

- Remove argv examples entirely.
  Rejected because short one-line payloads are still legitimate and sometimes cheaper.

### Decision: Runtime CLI performs conservative UTF-8 repair before JSON parsing

Before parsing descriptor payload text, the CLI will attempt a narrow repair pass for likely Latin-1-decoded UTF-8 mojibake. The repair only applies when the repaired JSON parses cleanly and recovers non-Latin-1 text that the original parse did not preserve.

Why:

- The observed failure mode comes from shell transport, not from the logical payload.
- The runtime should preserve durable room/message facts objectively when transport corruption is detectable and safely recoverable.

Alternative considered:

- Leave all repair to higher-level prompts and skills.
  Rejected because guidance lowers probability but does not eliminate the corruption class once the shell has already produced a bad argv payload.

## Risks / Trade-offs

- [Guidance drift across surfaces] -> Keep descriptors, skills, and prompts under the same change and add regression tests on all three surfaces.
- [Over-eager mojibake repair could mutate valid payloads] -> Use a conservative repair heuristic gated by successful JSON parse and recovered non-Latin-1 text.
- [Agents may still choose argv out of habit] -> Put stdin first in help, reinforce it in skills/prompts, and keep argv wording explicitly secondary.

## Migration Plan

1. Add an OpenSpec delta for the descriptor/help rule and the distributed skill/prompt rule.
2. Update descriptor examples/help rendering and CLI JSON parsing.
3. Update built-in skills, references, and runtime prompt guidance.
4. Run focused runtime CLI and guidance regression tests.
5. Archive the change so the durable specs absorb the new rule.

## Open Questions

- None for this change. The proposed protobuf-like compact payload mode is intentionally deferred to a later design discussion.
