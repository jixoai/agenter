## Context

The Heartbeat platform law already says that the durable truth is one merged message-parts stream plus grouped inspection pages. The remaining bug cluster comes from the last mile where that truth is flattened, grouped, or visually narrated too aggressively.

Current failure modes:

- assistant output is persisted as one aggregate response row, so later thinking can overwrite earlier timing/order
- request-side auxiliary facts are compared by message id churn, not by payload equality
- compact still appears as a `before-call` card plus a `compact` card instead of one compact event
- tool rows without results are treated as pending even when the durable input already tells the operator what is running
- older-page loading and dynamic group growth can visually disturb the top or bottom anchor of the stream

This change keeps the architecture honest: fix the ledger/projection rules first, then let the Heartbeat surface become a thin objective renderer over those rules.

## Goals / Non-Goals

**Goals**

- Preserve the objective chronological order of assistant spans around tool activity.
- Make grouped Heartbeat pages depend on payload truth instead of durable id churn.
- Collapse one compact event into one Heartbeat card.
- Show running tool intent before completion and reuse the same row through completion.
- Keep top paging/loading and latest-row stability visibly attached to the same stream.

**Non-Goals**

- Rework the shared ai-elements Context primitive or bottom-stick scroll law; those are handled by the prerequisite primitive change.
- Introduce a new Devtools-only heartbeat model separate from the main Heartbeat stream.
- Build a generic diff/history browser for every assistant segment.

## Decisions

### Persist assistant response spans as durable segments

Instead of rewriting one `response:assistant` message, the runtime will persist one durable assistant response message per chronological segment. Each segment has:

- `partType: thinking | text`
- its own started/updated timestamps
- stable segment index within the AI call

This makes `thinking -> tool_call -> thinking -> text` reconstructable without inference.

Alternative considered:

- Keep a single assistant response row and sort internal parts by timestamps.
  - Rejected because later streaming updates still collapse distinct reasoning phases into one mutable snapshot and make grouped rendering harder to reason about.

### Deduplicate auxiliary facts by payload equivalence

Grouped Heartbeat projection will compare request-side auxiliary messages by payload equality instead of message id order. If the effective system prompt/tools/config did not change, the next ordinary call does not need to replay them as fresh pre-call facts.

Compact is the exception: compact-specific prompt facts belong to the compact event, so they stay attached to the compact group.

Alternative considered:

- Keep comparing `auxiliaryMessageIds` positionally.
  - Rejected because durable ids can churn even when the visible prompt facts are identical, which creates false before-call noise.

### Treat compact as one surface event

The UI will merge a `before-call` group immediately followed by a `compact` group for the same `aiCallId` into one display group. The entry renderer then treats that display group as `compact-special`:

- compact mode: fold the prompt facts and show the compact result clearly
- detailed mode: reveal the compact prompt facts and tool inventory in the same card

Alternative considered:

- Keep separate cards and rely on naming alone.
  - Rejected because compact is a blocking one-shot action and splitting it across two cards obscures that fact.

### Running tool rows become objective once durable input exists

If a `tool_call` row already carries meaningful input, the Heartbeat surface should mark it as `Running` and show `Parameters` immediately. Completion only changes the same row's state/result payload.

Alternative considered:

- Keep `Pending` until `tool_result`.
  - Rejected because it hides objective execution intent even though the durable row already contains it.

### Keep Heartbeat surface validation close to the route

Some regressions are surface-local even though the law is shared: top paging loader placement, compact-card narration, and latest-row visibility while grouped history changes. Those will stay covered by route stories/tests for the Heartbeat stage.

## Risks / Trade-offs

- [Risk] Segmenting assistant responses increases the number of durable message-part rows. -> Mitigation: segment only at real reasoning/text boundaries and keep grouped rendering responsible for collapsing them visually where appropriate.
- [Risk] Payload-equivalence checks can be expensive on large prompt facts. -> Mitigation: compare only the already-grouped durable message payloads and keep the comparison scoped to adjacent auxiliary snapshots.
- [Risk] Compact-special rendering could hide useful prompt facts in compact mode. -> Mitigation: detailed mode reveals the exact prompt facts in the same card.

## Migration Plan

1. Update heartbeat persistence helpers to emit assistant response segments.
2. Update grouped projection to compare auxiliary payload truth and keep compact facts with the compact call.
3. Update Heartbeat display token/section builders and entry rendering for running tool rows and compact-special cards.
4. Refresh stage stories/tests for running tool params, compact grouping, top paging loader, and latest-row stability.
5. Run targeted backend and WebUI tests, then sync durable specs and archive.

Rollback strategy:

- If segment persistence regresses, the runtime can temporarily collapse segments back to one response row while keeping the grouped surface contract intact.
- If compact-special rendering regresses, the UI can temporarily fall back to separate cards without undoing the objective backend projection changes.
