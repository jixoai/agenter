## Context

The current repository still follows the law introduced by the earlier terminal-control-plane work: a terminal can be stopped without being deleted, and the stopped record remains part of the default durable terminal catalog until an explicit delete occurs. That law is encoded in both durable specs and implementations. It also leaks into runtime and AI surfaces: `terminal list` shows stopped terminals by default, runtime recovery treats stale running rows as stopped/killed rows that remain queryable as live catalog entries, and app surfaces can keep targeting the wrong dead instance because the dead instance still looks like part of the normal terminal universe.

The user now wants a different platform law:

- terminal live instances and terminal history must be different projections of one durable `terminal_instance` truth, not two separate tables and not one flat always-live catalog
- killed instances must leave the live terminal system by default
- terminal death must drive the full attention and runtime side effects, not only a SQL-state rewrite
- daemon cold restart must compensate for stale running terminals by replaying the same killed flow a real death would have triggered
- terminal history, archive, and delete must become explicit management surfaces so AI and operators can still inspect or erase the dead instance evidence when they choose

This is a cross-cutting change: it affects terminal-system lifecycle semantics, app-server runtime projections, attention-context updates, CLI/tool descriptors, and terminal-system UI behavior.

## Goals / Non-Goals

**Goals:**
- Replace the old "stopped terminal stays in the default live catalog" law with one-table live/history projections.
- Define one unified killed flow that every terminal-death path uses.
- Make daemon cold-start compensation run that same killed flow instead of silently normalizing stale rows.
- Ensure terminal death changes the associated attention context through durable attention facts and ends in `muted`.
- Expose explicit history-management commands and UI surfaces so dead terminals remain inspectable without polluting the default live list.
- Keep terminal output/transcript evidence available through terminal-owned history storage rather than inventing a second source of truth.

**Non-Goals:**
- Do not implement the change in this round.
- Do not preserve backward compatibility for old `terminal list` semantics.
- Do not create a second `terminal_history` table.
- Do not make cli-shell or any other app the owner of terminal lifecycle truth.
- Do not solve every future transcript archival policy in this one change; only define the core history/archive/delete law needed by terminal instances.

## Decisions

### Decision 1: One durable terminal-instance table, multiple projections

Terminal lifecycle and history stay on one durable terminal-instance truth. We do not introduce a separate `terminal_history` table. Instead, the system defines at least three projections:

- `live projection`: instances that are still actionable through the live terminal control plane
- `history projection`: dead instances kept for inspection or later archive/delete decisions
- `archived projection`: hidden or archival instances that are no longer part of the default history work queue but still exist as evidence

This gives the user the layered behavior they asked for without duplicating identity or splitting truth across two stores.

Alternative considered: keep the existing flat catalog and just add more filtering options. Rejected because the default law would remain wrong; stale dead terminals would still keep polluting the system's normal operating view.

Alternative considered: add a separate `terminal_history` table. Rejected because the user explicitly wants one terminal-instance table with state-driven projection, and separate tables would introduce unnecessary identity migration complexity.

### Decision 2: Killed flow is one authoritative death pipeline

Every terminal death path must converge on one TerminalSystem-owned killed pipeline. The pipeline must at least:

1. mark the terminal instance as killed/dead in durable lifecycle truth
2. remove it from the live registry and any live lookup indexes
3. clear live runtime attachments, focus bindings, pending approvals/actions, leases, waiters, and transient projection caches
4. commit terminal lifecycle attention facts through the normal attention/adapter path
5. move the associated attention context to `muted`
6. invalidate runtime/UI projections so live consumers stop treating the terminal as active

This pipeline is the key law change. The user explicitly rejected any design where daemon restart only rewrites the database state without replaying the side effects.

Alternative considered: let each death path do its own cleanup. Rejected because it guarantees drift between explicit stop, natural exit, and daemon compensation.

### Decision 3: Daemon cold-start compensation must replay killed flow

When the daemon boots and finds rows that were previously running but clearly have no live PTY anymore, it must not only reclassify them in SQL. It must synthesize the same authoritative killed transition the live system would have published if the daemon had stayed alive long enough to observe the death.

That means cold-start compensation must:

- reconstruct which instances need compensation
- run the same killed pipeline with a distinct reason such as `daemon_recovery_killed`
- emit the same lifecycle invalidation and attention effects as a live death

Alternative considered: treat daemon compensation as a storage-only migration. Rejected because it leaves runtime attention, live registry cleanup, and app projections inconsistent.

### Decision 4: Attention mutation is a consequence of terminal death, not a side-channel patch

Terminal death is a core-system event with attention consequences. The owning runtime must not silently flip attention state in app code or ad hoc cache code. Instead, terminal death should publish the relevant terminal lifecycle fact, and the runtime/adapter path should commit the attention consequence so the associated context settles into `muted` durably.

This preserves the platform law the user called out: visible state changes must be attributable to a committed action source.

Alternative considered: directly call `applyAttentionFocusState(..., "muted")` as an isolated helper whenever a terminal disappears. Rejected because it hides causality and makes daemon compensation diverge from ordinary lifecycle handling.

### Decision 5: `terminal list` is live-only; history requires explicit intent

The default shell/runtime query surface must now reflect the live projection only. Dead terminals move to explicit history management:

- `terminal list` => live terminals only
- `terminal history` => history projection
- `terminal archive` => move history item into archived projection
- `terminal delete` => final destructive removal of the remaining durable evidence, including output history according to terminal-owned retention rules

This is the simplest way to stop dead instances from interfering with AI reasoning.

Alternative considered: keep dead terminals in `terminal list` with a status tag. Rejected because it still burdens every caller and every model turn with filtering logic the platform can eliminate centrally.

### Decision 6: Terminal output history remains terminal-owned evidence

The terminal transcript/output chain remains terminal-system-owned truth. Database rows carry metadata and projection state, while output content may continue living in the existing output/log/archive storage. History/archive/delete semantics must therefore define what happens to output directories:

- killed => evidence remains inspectable through history
- archive => evidence remains but is removed from default work views
- delete => final destructive removal of the durable terminal instance and its remaining output evidence

This keeps transcript truth aligned with existing terminal output architecture and avoids inventing a second transcript store.

### Decision 7: History identity must remain collision-safe

The existing output layout appears to key directories by terminal id. Under the new law, one durable instance id may live long enough to transition live -> killed -> archived -> deleted. The design must therefore make one thing explicit during implementation: output history cannot accidentally collide with a later unrelated instance identity or resurrected record.

The implementation may solve this through instance-stable ids, monotonic versioning, or another collision-safe path, but the design must call out the risk now so the implementation does not preserve the old ambiguity.

## Risks / Trade-offs

- [Risk] Breaking the old stopped-terminal law will invalidate tests, CLI habits, and UI assumptions across multiple packages.  
  -> Mitigation: make the new live/history law explicit in specs first, then update all affected consumers through focused BDD coverage.

- [Risk] Cold-start compensation may emit many killed transitions at once after a crash.  
  -> Mitigation: define a deterministic compensation reason and ensure the killed pipeline is idempotent per instance.

- [Risk] Terminal output evidence deletion could become dangerous if identity and retention are fuzzy.  
  -> Mitigation: require collision-safe history identity and keep `archive` separate from final `delete`.

- [Risk] Attention muting on terminal death could accidentally suppress unrelated work if context binding is imprecise.  
  -> Mitigation: keep terminal-to-attention binding explicit and test that only the bound context is muted.

- [Risk] UI surfaces may regress if they still assume the selected terminal stays routable after kill.  
  -> Mitigation: the terminal-system UI spec must explicitly move killed instances into history/archive flows rather than trying to keep the old route law.

## Migration Plan

1. Update durable specs for terminal lifecycle, runtime projections, attention effects, CLI surfaces, and terminal-system UI behavior.
2. Introduce a terminal-instance projection model in TerminalSystem so live/history/archive are first-class queries over one durable record set.
3. Refactor terminal death handling into one shared killed pipeline and route explicit stop, natural exit, and daemon cold-start compensation through it.
4. Update runtime adapters and app-server recovery so terminal death emits the correct lifecycle/attention consequences and removes dead instances from live runtime views.
5. Add runtime CLI descriptors and built-in skill guidance for `terminal history`, `terminal archive`, and the new live-only `terminal list` law.
6. Rework terminal-system UI and any app consumers so killed terminals leave live routes and remain manageable through explicit history/archive surfaces.
7. Add BDD coverage for normal kill, natural exit, daemon restart compensation, history/archive/delete operations, and attention-context muting.

## Open Questions

- Which exact durable state names should implementation use for the one-table projection (`killed`, `archived`, etc.)? The law is fixed, but naming still needs final implementation choice.
- Should `terminal delete` physically remove transcript files immediately, or should it first stage a terminal-owned trash/recycle layer? The user asked for destructive delete, but implementation ergonomics may still need one final decision.
- Which current runtime/publication contracts need a compatibility shim during rollout, if any, before the breaking change lands everywhere at once?
