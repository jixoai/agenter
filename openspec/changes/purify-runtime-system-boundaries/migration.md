# Runtime Boundary Cleanup Migration

This change removes platform-authored obligation labels and hidden side effects from active runtime contracts.

## Removed fields and behaviors

- `chatTurnState`
- `chatObligationKind`
- `settlesWhen`
- `room_reply_pending`
- `self_update`
- `required_room_reply_sent`
- `no_external_reply_needed`
- `originAckFallback`
- implicit room-visible auto-ACK from tool work or relay sends
- default dedicated skill-only bootstrap/task context such as `ctx-skill-system`
- model-visible `terminal_idle_ready` task text

## Supported replacement paths

### Model guidance

- Room-visible decisions now come from explicit `message send`, `message edit`, or `message recall`.
- Attention settlement still uses `attention commit`, but the model decides completion itself instead of reading platform-authored obligation labels.
- Etiquette and playbooks remain in system-owned skills as soft guidance only.

### UI inspection

- Scheduler state is inspected through scheduler/debug surfaces.
- Room/terminal/skill/world facts are inspected through their explicit query or projection surfaces.
- Delivery truth now lives in the explicit delivery ledger: projections, dispatches, receipts, watches, and effects.

### Tests and diagnostics

- Assert objective room facts, scheduler signals, and explicit effects separately.
- Use effect-ledger or delivery receipts for causality instead of inferring success from `ai_call.running`, room read state, or hidden fallback messages.
- For skill changes, verify queryable index truth and ordinary attention-item publication instead of dedicated skill contexts.

## Scope boundary

`workspace` / `root_bash` privilege, root-workspace shell law, runtime-local CLI access, and workspace grants remain intentionally in scope as platform authority and are not removed by this cleanup.
