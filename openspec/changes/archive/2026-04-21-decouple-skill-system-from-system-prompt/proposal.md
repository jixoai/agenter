## Why

The runtime still binds skills deeply to the bootstrap system prompt, so skill discovery, prompt guidance, and runtime skill state are split across duplicate paths. That blocks dynamic skill add/remove/update, forces prompt glue to own operational details, and leaves legacy code paths alive even after the attention-first runtime laws already moved skill discovery toward runtime surfaces.

After the first cleanup, the runtime skill system still requires explicit `skill refresh` to notice on-disk changes. That leaves dynamic skill edits unreliable, and naïve directory watching would reintroduce noisy false positives because skill directories can contain unrelated state such as databases or caches. The user now wants the durable law to stay file-centric but become live: watch only declared skill files, let `skill` own config changes, and publish aggregated attention reminders instead of reintroducing prompt glue.

## What Changes

- **BREAKING** Remove the legacy `skillsList -> AGENTER_SYSTEM -> systemPrompt` assembly path from model request construction.
- Add a dedicated `skillSystem` that treats on-disk skill files as durable truth, exposes runtime skill operations, and updates AI-visible skill snapshots through attention-owned context state instead of prompt glue.
- Add a controlled runtime watcher model for skills: by default only `SKILL.md` and sibling `ccski.config.json` participate in live change detection, while extra watched files come only from declared config.
- Add `skill get-config` / `skill set-config` so operators can inspect and replace the watcher config without turning `skill` into a general file-read/write escape hatch.
- Aggregate watcher-detected skill changes by skill and flush them into attention reminders at the next model input collection boundary, with an idle debounce fallback that still wakes the loop when no other input arrives.
- Extend `AttentionContext` from a single mutable content blob into a fixed `template` plus mutable named `slots`, using the same `<Slot />` syntax family as prompt documents.
- Add slot-targeted attention commits so runtime systems can update a specific slot, defaulting to `target=default`, while readonly slots reject ordinary writes.
- Keep `AttentionItem + src` as the facts/reminder surface; `AttentionContext` remains the final rendered snapshot surface that is injected once and refreshed by explicit reads instead of repeated automatic full re-injection.
- Add a first-class `skill` runtime-local CLI/API surface and demote `ccski` to an internal SDK/read adapter rather than the user-facing command contract.
- Update runtime prompt guidance, skill progressive-disclosure law, and runtime shell discovery so the system teaches `skill` / `attention` surfaces without preserving the old prompt-bound skill path.

## Capabilities

### New Capabilities
- `attention-context-slot-template`: Define immutable attention context templates with named slots, readonly slot enforcement, and rendered context snapshots.
- `runtime-skill-system-surface`: Define the dedicated runtime skill system, writable skill CLI/API surface, and attention-backed skill snapshot publication.

### Modified Capabilities
- `attention-context-state`: Attention context state now includes template/slot-backed rendering semantics instead of a single raw mutable content field.
- `attention-bootstrap-protocol`: Bootstrap context injection now relies on rendered attention contexts rather than prompt-owned skill glue, while fact reminders remain attention items.
- `runtime-skills-cli-surface`: Runtime skill discovery and mutation move to the dedicated `skill` surface, and the old prompt-bound `skills.list` path is removed.
- `runtime-skill-progressive-disclosure`: Progressive disclosure guidance must expand skills through the new runtime surface instead of teaching `ccski` as the public contract.
- `runtime-builtin-skill-catalog`: Built-in skill catalogs remain package-owned, but public runtime discovery/read flows now resolve through the new skill system surface instead of `ccski`.
- `runtime-skill-system-surface`: The runtime skill system now owns live watcher topology, skill config resolution, and aggregated attention publication for on-disk skill changes.

## Impact

- Affected systems: `attention-system`, `app-server` runtime/prompt assembly, runtime skill watcher/config management, runtime CLI/API, built-in runtime skill catalog, prompt docs, and related WebUI/runtime inspection projections.
- Affected APIs: `AttentionContextState`, `AttentionCommitInput`, runtime-local CLI commands, skill config reads/writes, and model bootstrap input assembly.
- Affected tests/specs: attention-state tests, runtime skill tests, watcher/config tests, prompt assembly tests, runtime CLI tests, and durable specs covering attention bootstrap, skill progressive disclosure, and skill watcher law.
