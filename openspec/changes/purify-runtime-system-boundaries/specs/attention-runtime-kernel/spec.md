## ADDED Requirements

### Requirement: Attention runtime kernel SHALL track AI-visible context snapshots

The attention runtime kernel SHALL maintain an `attentionContextSnapshot` map keyed by `contextId`. This snapshot represents the last successfully injected AI-visible representation for that context, not the newest raw `AttentionContext` stored in runtime state.

#### Scenario: Clear or compact resets the AI-visible snapshot
- **WHEN** `ai-messages` are cleared, compacted away, or otherwise reset to an empty prompt history
- **THEN** the runtime clears the corresponding `attentionContextSnapshot`
- **AND** later injections behave as if the model has not yet seen any attention context seed

#### Scenario: Snapshot stores injected view rather than latest raw state
- **WHEN** a context is serialized into the model input
- **THEN** the runtime records the injected AI-visible representation for that `contextId`
- **AND** the snapshot does not silently advance to later raw context mutations until another successful injection occurs

### Requirement: Attention context seeding SHALL be focus-aware and semantically clean

Before the runtime relies on a context in model-visible work, it SHALL ensure the model has a seeded `AttentionContext` view for that context. Focus state determines the seed shape:

- `focused`: full context injection
- `background`: minimal necessary summary injection
- `muted`: no automatic context injection

Any seeded context view SHALL keep scheduler metadata separate from semantic facts and SHALL NOT serialize source-authored obligation judgments as truth.

#### Scenario: Focused context seeds a full context
- **WHEN** a focused context has no AI-visible snapshot and the runtime needs that context in model-visible work
- **THEN** the runtime injects a full `AttentionContext` user-role message for that context
- **AND** the message omits removed obligation labels such as `chatTurnState`, `chatObligationKind`, `settlesWhen`, `room_reply_pending`, `self_update`, `required_room_reply_sent`, and `no_external_reply_needed`

#### Scenario: Background context seeds only a minimal summary
- **WHEN** a background context has no AI-visible snapshot and the runtime needs that context in model-visible work
- **THEN** the runtime injects only the minimal context summary needed to identify that context
- **AND** the summary MAY omit scores or other non-essential scheduler details

#### Scenario: Muted context is not auto-seeded
- **WHEN** a muted context has no AI-visible snapshot
- **THEN** the runtime does not automatically inject that context into `ai-messages`
- **AND** full detail remains available through `attention-cli` or other explicit attention query capabilities

### Requirement: Commit attention-item injection SHALL be per-context and cost-based

Whenever the runtime is about to serialize committed attention items into `ai-messages`, it SHALL evaluate each relevant `AttentionContext` independently instead of relying on a special loop-boundary mode.

For each context:

1. If the context has no AI-visible snapshot, seed it first using the focus-aware rules above.
2. Only `focused` contexts are eligible for `CommitAttentionItems` injection.
3. For a `focused` context, compare:
   - `AttentionContextUserRoleMessageLength * 1.5`
   - `AttentionItemsUserRoleMessageLength`
4. Inject whichever representation is cheaper for that context.
5. Combine the chosen per-context outputs into the final model input, which MAY therefore contain a mix of `AttentionContext` messages and `AttentionItems` messages.

An implementation MAY later compare `diff` vs `full` context serialization after the context path wins the cost test, but that optimization is optional and SHALL NOT be required for the first cleanup wave.

For this requirement, `AttentionContextUserRoleMessageLength` and `AttentionItemsUserRoleMessageLength` mean the stable length of the final serialized `user`-role text that would actually be injected for that branch. The comparison SHALL be based on that final injected text shape, including any routing/debug metadata that is truly part of the injected payload, rather than raw object size, pre-serialization structure size, or provider-token estimates.

#### Scenario: Missing focused snapshot forces context seed first
- **WHEN** a focused context has committed attention items but no AI-visible snapshot
- **THEN** the runtime first injects that context's seeded `AttentionContext`
- **AND** only after that seed exists may later injections choose between context and items for that context

#### Scenario: Focused context chooses the cheaper representation
- **WHEN** a focused context has both a current `AttentionContext` serialization and committed `AttentionItems`
- **THEN** the runtime compares `AttentionContextUserRoleMessageLength * 1.5` against `AttentionItemsUserRoleMessageLength`
- **AND** it injects the cheaper representation for that context

#### Scenario: Background context skips commit-item injection
- **WHEN** a background context has committed attention items
- **THEN** the runtime may seed the background summary if needed
- **AND** it does not serialize that context's `CommitAttentionItems` into `ai-messages`

#### Scenario: Final output can mix contexts and items
- **WHEN** multiple contexts are evaluated during the same injection pass
- **THEN** one focused context MAY contribute `AttentionItems` while another contributes an `AttentionContext`
- **AND** the runtime combines those per-context decisions into a single model input payload

### Requirement: Notify attention items SHALL serialize as items

`Notify` attention items are an explicit exception to the commit comparison rule. They SHALL serialize as attention-item payloads rather than participating in the `AttentionContext * 1.5` vs `AttentionItems` cost comparison.

The normal `attentionContextSnapshot` seeding rules still apply to any context material that must accompany the notify item.

#### Scenario: Notify bypasses commit-cost comparison
- **WHEN** a notify attention item is selected for model-visible delivery
- **THEN** the runtime serializes that notify payload as attention-item content
- **AND** it does not replace the notify payload with a cheaper context-only representation

#### Scenario: Notify still respects focus-aware seeding
- **WHEN** a notify attention item is selected for a context whose AI-visible snapshot is missing
- **THEN** the runtime still applies the normal focus-aware seeding law for any accompanying context material
- **AND** `background` remains summary-only while `muted` still does not auto-seed full context

### Requirement: Notify quota SHALL be configurable, queryable, and period-based by default

The runtime SHALL enforce a configurable notify quota policy. The default policy in this change SHALL be time-period based and SHALL include at least:

- `muted`: one notify every 12 hours
- `background`: one notify every 0.5 hours

This default contract only fixes the muted/background policy. Any focused-context notify policy remains separately configurable and is not constrained by this default requirement.

Under the default time-period policy, notify eligibility SHALL be computed from the quota target's notify-send records that fall within the configured rolling time window for that policy.

The runtime SHALL provide query capability to:

- return the current remaining notify quota together with the effective quota configuration
- return whether a notify can be sent right now for a given target
- return historical notify-send records used for quota accounting

#### Scenario: Muted notify is throttled by default period
- **WHEN** a muted context has already emitted a notify within the last 12 hours under the default policy
- **THEN** the runtime reports that another notify cannot currently be sent for that quota target
- **AND** the remaining-quota query returns the effective muted policy together with the current remaining state

#### Scenario: Background notify is throttled by default period
- **WHEN** a background context has already emitted a notify within the last 0.5 hours under the default policy
- **THEN** the runtime reports that another notify cannot currently be sent for that quota target
- **AND** the remaining-quota query returns the effective background policy together with the current remaining state

#### Scenario: Notify history is queryable
- **WHEN** an operator or model inspects notify quota state
- **THEN** the runtime can return historical notify-send records relevant to the quota decision
- **AND** those records are sufficient to explain why notify is or is not currently allowed

#### Scenario: Notify can-send query is explicit
- **WHEN** an operator or model asks whether a notify can be sent right now for a given target
- **THEN** the runtime returns an explicit send-eligibility result for that target
- **AND** the result is explainable against the effective quota configuration and relevant notify history

### Requirement: Snapshot advancement and staged-item clearing SHALL use a single successful-injection boundary

The runtime SHALL define one successful-injection boundary for each AI call. For this change, that boundary is reached when response SSE delivery has started and the first returned SSE event is not an error event. Only after crossing that boundary may it advance `attentionContextSnapshot` and clear staged attention items that were included in the call.

This requirement aligns with the existing durable delivery-acceptance law. It specializes the same first-valid-stream-event acceptance boundary for prompt-injection bookkeeping; it does not introduce a second, provider-specific acceptance model.

Before that boundary, request failure, cancellation, retry, or replacement SHALL leave the prior snapshot and staged items intact.

#### Scenario: Failed request does not advance snapshot
- **WHEN** the runtime prepares context or item injection for a request that fails or is cancelled before the successful-injection boundary
- **THEN** `attentionContextSnapshot` remains at its previous committed state
- **AND** the staged attention items remain available for retry

#### Scenario: Successful request advances injected view only
- **WHEN** response SSE delivery has started for a request and the first returned SSE event is not an error event
- **THEN** it advances `attentionContextSnapshot` to the exact context/item view that was injected for that request
- **AND** it does not skip ahead to raw attention changes that occurred later while the request was in flight

#### Scenario: Error-first SSE does not count as successful injection
- **WHEN** response SSE delivery begins but the first returned SSE event is an error event
- **THEN** the runtime does not advance `attentionContextSnapshot`
- **AND** it does not clear staged keyed attention items on the basis of that failed start

#### Scenario: Later stream interruption does not roll back a crossed boundary
- **WHEN** response SSE delivery has started, the first returned SSE event is not an error event, and a later stream interruption or failure happens afterward
- **THEN** the runtime keeps the snapshot advancement and staged-item clearing decisions already committed at that successful-injection boundary
- **AND** it does not retroactively roll them back on the basis of the later stream interruption

### Requirement: Commit attention-item staging SHALL be keyed, idempotent, and success-committed

The runtime SHALL stage commit attention items through keyed map semantics rather than append-only accumulation. Equivalent operations SHALL exist for:

- `commit(key, item)` or equivalent keyed upsert
- `get(key)` or equivalent keyed read
- `uncommit(key)` or equivalent keyed removal
- `reset()` or equivalent full staged-map clear
- `set(map)` or equivalent explicit staged-map replacement

Keys SHALL be stable and namespaced enough to avoid accidental cross-producer collisions.

When a staged-map API exposes `set(map)` or `reset()`, its replacement scope SHALL be explicit. By default, scoped replacement/reset SHALL apply only to the addressed namespace or explicitly targeted staged subset, not to unrelated staged keys from other producers.

Staged items SHALL only be removed after the successful-injection boundary for the request that carried them.

#### Scenario: Recommitting the same key stays quiet
- **WHEN** the runtime stages an item under the same key multiple times before successful injection
- **THEN** the latest value replaces the earlier staged value for that key
- **AND** the runtime does not create duplicate model-visible noise solely because the same key was recommitted

#### Scenario: Failed injection keeps staged map
- **WHEN** a request that carried staged items fails before the successful-injection boundary
- **THEN** the staged map retains those keyed items
- **AND** a later retry can re-use the same staged keys without first rebuilding unrelated noise

#### Scenario: Scoped replacement does not wipe unrelated staged keys
- **WHEN** one producer replaces or resets its staged map view
- **THEN** only the explicitly addressed namespace or staged subset is replaced or cleared
- **AND** unrelated staged keys from other producers remain intact

#### Scenario: Successful injection clears only committed staged entries
- **WHEN** a request successfully injects staged attention items
- **THEN** the runtime clears the staged entries that were actually committed in that request
- **AND** unrelated staged keys remain available for later injections
