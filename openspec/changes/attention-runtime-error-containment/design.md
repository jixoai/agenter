## Context

The current attention-first runtime direction already makes `attention-context` and `attention-item` the semantic source of truth, but scheduler behavior is still too permissive. In practice, `score > 0` can trigger repeated model rounds even when the previous round made no semantic progress or the provider/tool path is failing in the same way. That creates two coupled failures: the kernel burns tokens and CPU, and the WebUI receives an endless stream of hot updates that look like work but are not reducing entropy.

This change defines the containment law that sits underneath later performance work. It does not weaken the core principle that unresolved attention debt must remain active until it is actually reduced; it clarifies when the runtime may re-enter the model and when it must stop, wait, or escalate.

## Goals / Non-Goals

**Goals:**
- Preserve the attention-first law that unresolved scores remain durable obligations until they are reduced or explicitly abandoned.
- Prevent repeated no-progress model rounds and repeated equivalent failures from causing unbounded token burn.
- Make runtime control state durable and inspectable through session facts, model-call records, and UI publication.
- Ensure stop/abort semantics cancel in-flight work predictably through `AbortSignal` rather than passive timeout.
- Give future performance work a stable scheduler contract so memory and render measurements are meaningful.

**Non-Goals:**
- Optimizing WebUI render paths, virtualization, or memory usage; that belongs to the follow-up performance platform change.
- Redesigning Devtools information architecture beyond the minimal state needed to explain containment.
- Changing the core scoring model, attention item structure, or egress routing semantics.

## Decisions

### 1. Separate unresolved debt from runnable work
The runtime will track unresolved attention debt and runnable work as related but different concepts. `score > 0` keeps a context active, but the scheduler only enters a new model round when there is a valid wake cause such as fresh ingress, a backoff timer expiry, a resumable pending plan, or another explicit runtime trigger.

Why: the current behavior conflates “still unresolved” with “call the model again now”, which is how empty loops happen.

Alternative considered: keep unconditional self-wake and rely on prompt wording to avoid waste. Rejected because scheduler law must protect the system even when model output is poor.

### 2. Treat no-progress as a first-class runtime outcome
Each cycle will classify its outcome as `progress`, `no_progress`, `blocked`, `backoff`, or `aborted`. A round only counts as `progress` if it changes attention state, schedules a concrete external action, or records another durable state transition that moves the task forward.

Why: the kernel needs an observable definition of progress before it can suppress unproductive retries.

Alternative considered: infer progress only from whether the model produced text. Rejected because text without a semantic state transition is exactly the failure mode we need to contain.

### 3. Escalate repeated equivalent failures into backoff or blocked state
The runtime will fingerprint repeated equivalent failures and repeated equivalent no-progress outcomes per active attention context/session. When the same pattern crosses configured thresholds, the scheduler transitions to `backoff` or `blocked` instead of launching another immediate model round.

Why: this keeps the system autonomous when recovery is plausible, but stops infinite churn when the same path is clearly not working.

Alternative considered: stop after the first failure. Rejected because transient model/provider/tool failures still need automatic recovery.

### 4. Drive cancellation through shared AbortSignals
Every in-flight model call and tool execution launched by the runtime will receive an `AbortSignal` rooted in the session runtime. `session.stop` cancels current work and leaves the runtime resumable; `session.abort` cancels current work and then tears down owned resources.

Why: timeouts are not a real control plane. Users and scheduler policy need immediate cancellation semantics.

Alternative considered: keep stop/abort as high-level flags and let providers time out naturally. Rejected because it prolongs wasted work and muddies lifecycle records.

### 5. Publish containment state as durable runtime facts
The runtime publication layer will expose scheduler control state and wake metadata directly instead of forcing WebUI to infer them from trace noise. This includes `runtimeStatus`, `wakeCause`, `retryCount`, `blockedReason`, `nextWakeAt`, and `lastProgressAt`.

Why: containment only helps users if the stopped/backoff/blocked state is inspectable and debuggable.

Alternative considered: keep containment internal and surface it only in logs. Rejected because UI and diagnostics need the same source of truth.

## Risks / Trade-offs

- [Containment thresholds are too aggressive] -> Start with conservative retry budgets and explicit blocked/backoff facts so behavior is observable and adjustable.
- [Failure fingerprinting groups unrelated failures together] -> Fingerprint on stable normalized fields such as provider/tool identity, error class, and target context instead of raw text alone.
- [Cancellation introduces partial side effects] -> Only mark a cycle as progress when the durable state transition is committed; canceled work remains explicitly canceled.
- [Waiting/backoff could be mistaken for deadlock] -> Publish `wakeCause`, `nextWakeAt`, and `blockedReason` so operators can tell intentional waiting from a bug.

## Migration Plan

1. Add the new containment spec and extend lifecycle/publication specs with the required control-state semantics.
2. Refactor the session runtime scheduler to classify cycle outcomes and gate self-wake decisions on explicit wake causes.
3. Introduce failure/no-progress fingerprinting plus retry budget tracking in runtime persistence.
4. Thread shared `AbortSignal` control through model-call and tool execution wrappers.
5. Publish containment facts to client runtime consumers and update WebUI inspectors to read them.
6. Verify with real AI/provider runs that solvable work converges while repeated failure/no-progress paths transition to backoff/blocked instead of looping forever.

## Open Questions

- Whether retry budgets should be global per session or independently tracked per attention context while the multi-context runtime is still in flight.
- Whether backoff expiry should automatically wake the runtime when the session is backgrounded, or only when the session remains started and eligible to run.
