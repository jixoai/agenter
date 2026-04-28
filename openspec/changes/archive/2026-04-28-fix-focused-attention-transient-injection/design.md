## Context

The current runtime has two different kinds of model input mixed into one array:

- long-lived prompt-window memory, which is replayed into later calls until compaction;
- current-call attention protocol payloads, which describe the present attention context and newly committed item deltas.

The corrected law is two-plane:

- `AttentionContext` is a boundary injection plane. It carries the current projection: metadata, focus state, scores, and bootstrap-visible context snapshots/diffs. It is refreshed at boundaries such as prompt compaction and cold start, where the runtime has to re-establish what projection the model is starting from.
- `AttentionItems` is an in-flight notification plane. It carries only item detail for commits that happened "now" during the current runtime boundary. It is not a history replay mechanism.

`AgenterAI.send()` currently stores incoming attention protocol payloads in the prompt window before the model call. Later calls replay those messages, so a prior `AttentionContexts.metadata` block and its item payloads are sent again. `SessionRuntime` also has a cursor-style fallback that can select recent historical commits when no `lastSeenCommitId` exists, causing old focused items to be injected as if they were new.

## Goals / Non-Goals

**Goals:**

- Preserve focused attention's active notification behavior: newly committed focused items are directly visible in the current AI call.
- Prevent historical `AttentionContexts.metadata` and `AttentionItems` from being replayed through prompt-window memory.
- Rebuild `AttentionContext` projection at hard boundaries such as compaction and restart without injecting historical `AttentionItems`.
- Ensure AI-authored `attention commit` tool calls update context state without causing a redundant item reminder in a later request.
- Keep `ai_call.request.messages` as exact provider request truth for debugging.
- Keep historical attention facts available through attention CLI/API and persisted state.
- Avoid any `ctx-skill-system` special case; fix the platform law.

**Non-Goals:**

- Do not redesign attention scoring or query APIs.
- Do not remove attention context metadata from the current call.
- Do not make all attention item detail lazy; focused new commit deltas still inject directly.
- Do not change provider HTTP request schemas beyond message assembly.

## Decisions

1. Split provider request assembly from prompt-window persistence.

   `AgenterAI` will classify attention protocol messages as transient when they come from `source: "attention"` with `meta.attentionProtocolKind` of `context` or `items`. Non-transient incoming messages continue to enter the prompt window. Transient attention messages are appended only to the current provider request.

   Alternative considered: keep writing everything to prompt window and filter on replay. Rejected because it leaves memory semantics wrong and makes compaction/debugging harder.

2. Keep `ai_call.request.messages` as the actual request body.

   Even though transient attention inputs do not become prompt memory, the `ai_call` ledger must still record the request exactly as sent. This is the only reliable way to debug provider calls like #1115.

   Alternative considered: store only prompt-window messages. Rejected because it hides current-call attention evidence.

3. Replace cursor catch-up with focused commit delta selection.

   The runtime should inject item payloads only for commits selected by the current collection boundary. If a context merely changes focus, scores already summarize outstanding obligations in `AttentionContexts.metadata`; the model can query history when needed.

   Alternative considered: maintain per-model cursor state. Rejected because the model does not need a historical replay cursor; the durable attention store already owns history.

4. Treat interleaved provider-loop attention the same way.

   Attention committed at a tool-result boundary is a current continuation input. It may appear in the continuation request and `ai_call` record, but it must not become prompt-window memory for future unrelated calls.

5. Use boundaries for context projection, not item replay.

   After compact or cold restart, the runtime may not know which context projection the next model round has in memory. The correct move is to re-inject `AttentionContext` metadata/scores/snapshots so the model has a fresh projection baseline. It must not re-inject historical `AttentionItems`, because no new item was committed at that boundary.

   Alternative considered: treat restart/compact as "model saw nothing" and replay recent items. Rejected because that confuses state synchronization with event notification.

6. Do not feed AI-authored commits back to the AI as item reminders.

   When the model calls `attention commit`, it is already the actor performing the mutation. The runtime records the new context state and scores, but should not wake a later model call with the same commit as if it were external input.

## Risks / Trade-offs

- [Risk] Some existing tests may assume every incoming model message is retained in prompt memory. → Mitigation: update tests around visible behavior: ordinary user/provider messages persist; attention protocol messages do not.
- [Risk] A model may need historical item detail after a focus switch or boundary refresh. → Mitigation: `AttentionContexts.metadata` still exposes context id and scores, and attention CLI/API remains the path for history/detail lookup.
- [Risk] Debugging could lose evidence if transient inputs are not persisted anywhere. → Mitigation: `ai_call.request.messages` remains exact request truth.

## Migration Plan

1. Add BDD tests that reproduce the duplicate metadata/items replay.
2. Update `AgenterAI` message assembly to separate prompt memory from current request inputs.
3. Update `SessionRuntime` attention item selection to emit only current focused commit deltas.
4. Update durable specs and app-server docs.
5. Verify focused tests, typecheck, and a real DB/request walkthrough against the known Call #1115 failure mode.

## Open Questions

- Whether a future UI inspector should display transient attention inputs under a dedicated "current request inputs" section instead of mixing them with prompt-window history.

## Plain Language Explanation

`AttentionContext` 像一张当前地图：它告诉 AI 现在有哪些上下文、谁是 focused、每个上下文还有多少 score 没处理。compact 之后、进程重启之后，AI 的“地图记忆”可能断了，所以 runtime 要重新把这张地图递给它。

`AttentionItems` 像敲门提醒：只有刚刚有人真的 commit 了新的事情，才需要把具体 item 直接塞进这一轮 AI-call，让 AI 立刻注意到。旧 item 已经在数据库里，地图上的 scores 也已经投影了它们；如果 AI 需要细节，就用 attention CLI/API 查。

所以：边界注入 Context，进行中注入 Items。focus 切换、compact、restart 都不是“新 item 发生了”；AI 自己调用 `attention commit` 也不是外部新提醒，它只是把地图改了。
