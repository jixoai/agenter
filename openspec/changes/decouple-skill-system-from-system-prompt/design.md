## Context

The current runtime still computes `runtimeSkillsList` in `session-runtime`, passes it into `AgenterAI`, and splices it into `AGENTER_SYSTEM` before every model call. That leaves three truths for the same skill surface:

- on-disk skill files
- runtime-generated skill catalog / CLI
- prompt-owned `skillsList` glue

At the same time, `AttentionContext` is still modeled as one mutable content string, so the runtime cannot publish structured system snapshots such as a skill catalog without rewriting the entire context body. The user explicitly wants a simpler law: `AttentionContext` is still a file-like surface, but it needs immutable template structure plus mutable slot bodies, using the same `<Slot />` syntax family as prompt docs.

This change is cross-cutting:

- `attention-system` state and commit semantics change
- runtime bootstrap / prompt assembly changes
- runtime CLI/API gains a dedicated `skill` surface
- old prompt-bound skill code must be deleted rather than preserved for compatibility

## Goals / Non-Goals

**Goals:**
- Remove the legacy `skillsList -> systemPrompt` assembly path completely.
- Keep `AttentionContext` simple: immutable `template`, mutable `slots`, derived rendered `content`.
- Let ordinary attention commits target named writable slots, defaulting to `target=default`.
- Allow runtime-owned systems to refresh readonly slots through an explicit internal write path.
- Publish the AI-visible skill snapshot through an attention-backed context instead of prompt glue.
- Expose a first-class `skill` runtime-local CLI/API and demote `ccski` to internal read plumbing.
- Make on-disk skill changes live through a controlled watcher model that watches only declared skill files.
- Let operators inspect and replace per-skill watcher config through the runtime `skill` surface.
- Preserve the existing law that `AttentionItem + src` is the fact/reminder surface while `AttentionContext` is the final snapshot surface.

**Non-Goals:**
- Do not turn `AttentionContext` into a general MDX execution engine.
- Do not auto-reinject the full rendered context on every slot change.
- Do not preserve compatibility aliases for the old prompt-bound skills path.
- Do not turn `skill` into a general arbitrary file browser or editor for skill directories.

## Decisions

### 1. `AttentionContext` becomes `template + slots + rendered content`

`AttentionContextState` will gain:

- `template: string`
- `slots: Record<string, string>`
- existing `content` retained as the derived render result

The default template is `<Slot name="default"/>`. Rendering stays minimal and deterministic:

- support `<Slot name="name"/>`
- support `<Slot name="name" readonly/>`
- missing slot renders as empty string
- no expressions, conditionals, imports, or general MDX execution

Why this instead of a separate injection context type:

- it keeps the user’s “context is just a file” law intact
- it avoids a second context hierarchy
- it gives `skillSystem` and future systems one shared composition primitive

### 2. Slot writes are commit-targeted; readonly is internal-only

`AttentionCommitInput` gains `target?: string`, defaulting to `default`.

Ordinary `attention commit` rules:

- unknown target slot: reject
- targeting readonly slot: reject
- `update` / `diff` / `clean` only mutate the targeted slot body

Runtime-internal updates use a dedicated slot setter and bypass readonly protection intentionally. This keeps readonly enforcement simple and auditable without inventing privilege flags on public commits.

### 3. Rendered context snapshot remains compatibility surface

Existing runtime and WebUI code reads `context.content`. That field will remain, but it becomes derived from `template + slots`. This avoids a repo-wide flag day while still moving ownership of structured composition into the attention core.

### 4. Skill snapshot moves from prompt glue to attention-backed context

The runtime will own a canonical skill context, conceptually `ctx-skill-system`, whose template contains:

```md
<Slot name="skills-list" readonly/>
<Slot name="default"/>
```

`skills-list` stores the runtime-generated skill summary for AI discovery. `default` is left available for future operator-owned notes if needed.

The runtime injects that context snapshot once when assembling the bootstrap context, as part of ordinary attention-context publication. Later skill mutations do not force another full snapshot injection; they emit `AttentionItem` reminders so the AI can re-read the context through CLI if needed.

Why not keep auto-reinjection:

- it keeps model context smaller
- it preserves the law that facts/reminders flow through items, not through repeating full snapshots
- it matches the current user expectation that contexts are baseline surfaces and items are the active facts

The provider-visible bootstrap stays three-stage and minimal:

- `summary`: `## PreAICallContext Summary`
- `context`: `## AttentionContexts.metadata` plus rendered readonly snapshots such as `ctx-skill-system`
- `items`: unresolved attention deltas only

This keeps round-level bootstrap facts explicit without reintroducing provider-owned system guide blocks or duplicating attention-item content in the bootstrap surface.

### 5. `skill` becomes the public runtime surface; `ccski` becomes internal plumbing

The runtime adds a dedicated `skill` namespace for:

- `list`
- `search`
- `info`
- `upsert`
- `remove`
- `refresh`

`ccski` is no longer the public shell contract. Its current read/discovery logic becomes an internal SDK/adapter used by the new skill system where appropriate.

Why this instead of extending `ccski`:

- `ccski` is already semantically tied to read-time skill expansion
- the new system has mutation semantics and attention publication side-effects
- keeping one dedicated runtime surface makes the system law clearer and removes public legacy naming

### 6. Built-in skills stay package-owned and read-only

Built-in runtime skills remain authored under package-owned `skills/**/SKILL.md` and aggregated into the generated catalog. They remain readable through the new skill surface but are not writable by `skill upsert/remove`. Only shared/global/avatar on-disk roots are writable truths.

For live refresh, the runtime treats the package-owned built-in source path as the current file truth when that file exists, while the generated catalog remains the discovery/index baseline that tells the runtime which built-in source paths belong to the platform.

### 7. Prompt docs keep persona law; runtime docs keep operational law

Prompt documents stop receiving a pre-expanded `skillsList` string. `AGENTER_SYSTEM` may still teach that skills can be discovered through runtime surfaces, but the actual skill snapshot and file-path expansion belong to the runtime skill system and attention-backed context snapshots.

### 8. Skill config is sibling `ccski.config.json`, not directory-wide convention

Each skill directory may contain an optional sibling `ccski.config.json` beside `SKILL.md`.

Initial schema:

```json
{
  "files": ["references/*.md", "examples/**/*.md"]
}
```

Rules:

- default watcher truth is always `SKILL.md + ccski.config.json`
- `files` extends the watcher scope with skill-related files only
- the syntax is a controlled subset of npm `package.json.files`: include-only patterns, relative to the skill directory, with no negation and no path escape
- missing config means “watch only the defaults”

This keeps the law simple: the runtime never infers skill truth from arbitrary sibling files.

### 9. Watch topology stays shallow by default; recursive scope is opt-in and bounded

Watcher topology:

- watch each writable skill root shallowly to detect skill add/remove/rename
- watch each visible skill directory shallowly for `SKILL.md` and `ccski.config.json`
- for extra declared files:
  - exact files and shallow globs watch their anchor directory non-recursively
  - `**` subtree patterns fall back to subtree snapshot polling instead of recursive whole-directory watching

Why:

- skill directories may contain polluted operational files such as sqlite/db/cache artifacts
- default shallow watching avoids false positives from unrelated file churn
- declared recursive scope remains possible, but only when the skill author opted into it through config

### 10. Flush law is “next collection boundary first, idle fallback second”

Watcher events do not immediately emit attention commits.

Instead the runtime:

1. marks the affected skill/root dirty
2. waits for the next model input collection boundary
3. re-reads skill truth and emits aggregated reminders per changed skill before the round is assembled

If no round is about to start, an idle debounce fallback performs the same refresh and wakes the loop so the reminder still becomes visible.

This preserves the existing attention law:

- full rendered skill snapshot belongs to the canonical context
- watcher-triggered changes surface as attention reminders
- the system re-derives truth from disk instead of trusting raw watcher events

### 11. `skill get-config` / `skill set-config` are controlled metadata operations

Public runtime surface additions:

- `skill get-config`
- `skill set-config`

`get-config` returns only:

- skill identity and root metadata
- `skillDir`, `skillPath`, `configPath`
- config existence + parsed config
- resolved watch targets

It does not become a backdoor for reading arbitrary sibling files.

`set-config` replaces the whole config object and immediately refreshes watcher topology.

Authority rules:

- shared/global/avatar skill configs are writable through the runtime skill system
- built-in `get-config` is allowed
- built-in `set-config` is allowed only when the runtime already has workspace `rw` authority for that package-owned source path; `skill` itself does not add new filesystem power

## Risks / Trade-offs

- [Render compatibility drift] Existing code assumes `content` is the primary field → Keep `content` as derived output and migrate callers incrementally.
- [Readonly bypass abuse] Internal slot setters could become ad-hoc escape hatches → Keep them private to runtime-owned systems and avoid public flags that masquerade as privilege.
- [Spec drift during cleanup] Removing the old prompt path touches multiple capabilities → Update OpenSpec artifacts first and then delete the legacy code path in the same change.
- [Mutation complexity] `skill upsert/remove` changes both filesystem truth and attention publication → Centralize them inside `skillSystem` instead of scattering writes across CLI handlers.
- [Watcher noise] Directory watches can overfire or miss intent boundaries → treat events as dirtiness hints only, then recompute truth from disk before publishing reminders.
- [Recursive watch portability] Deep recursive watch support is inconsistent across platforms → keep recursive scope opt-in and poll subtree snapshots for `**` patterns instead of depending on platform-specific recursive watchers.

## Migration Plan

1. Add slot/template rendering to `attention-system` and preserve derived `content`.
2. Introduce the canonical runtime skill context and internal readonly slot update path.
3. Add the dedicated `skill` runtime-local CLI/API and route skill reads/mutations through `skillSystem`.
4. Switch runtime bootstrap to publish the skill snapshot through attention-backed context state.
5. Add controlled skill watcher/config management plus `skill get-config/set-config`.
6. Delete `skillsList -> AGENTER_SYSTEM -> systemPrompt` assembly and update prompt guidance/tests.
7. Update runtime specs/tests/docs and confirm no legacy public path remains.

## Open Questions

- None for implementation. This change intentionally chooses the breaking cleanup path and does not preserve the old prompt-bound contract.
