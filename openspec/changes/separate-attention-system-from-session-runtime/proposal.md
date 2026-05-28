## Why

Today `AttentionSystem` already has its own durable state format, but the live write path for external ingress still sits inside `SessionRuntime`. That makes attention truth depend on whether a runtime instance is alive, which violates the goal that attention should be an independently maintainable system rather than a runtime-local side effect bucket.

This becomes visible in message follow-up, lifecycle projection, and future mounted-system work: external systems should be able to commit durable attention truth even when a specific session runtime is stopped, while `SessionRuntime` should cold-start from that truth and continue processing it. We need to promote that boundary into an explicit long-term law now, with BDD and repeated review gates so follow-up implementation does not drift back into runtime-owned glue.

## What Changes

- **BREAKING** separate durable attention ingress ownership from `SessionRuntime`; external systems commit attention truth through an independent attention control plane instead of writing through runtime-local methods.
- Introduce an attention-owned ingress/persistence/recovery law so systems such as `message-system` can append durable attention work while the owner runtime is offline.
- Re-scope `SessionRuntime` as an attention consumer/orchestrator: on start or resume it restores current attention truth, drains eligible work, and advances it, but it is not the only write gateway.
- Add explicit BDD-driven review checkpoints for architecture alignment: boundary review before code, behavior review before migration, and post-migration regression review against the original user law.
- Record migration/debt boundaries clearly so future changes such as workspace-mounted systems can build on an independently owned attention core instead of growing new runtime-specific glue.

## Capabilities

### New Capabilities
- `attention-control-plane`: independent durable attention ingress, persistence, and recovery outside session-runtime lifecycle

### Modified Capabilities
- `attention-context-state`: context durability must remain valid when commits are produced outside a live session runtime
- `attention-runtime-kernel`: runtime becomes an attention consumer/orchestrator rather than the sole ingress writer
- `runtime-system-kernel-adapters`: adapters must target the independent attention ingress contract instead of runtime-private commit paths
- `runtime-system-boundary-law`: external systems may write durable attention truth without requiring a live runtime instance
- `session-runtime-attention-message`: message follow-up and room-backed attention ingress must survive runtime downtime by landing in attention durability first

## Impact

- Affected packages: `@agenter/attention-system`, `@agenter/app-server`, `@agenter/message-system`, and follow-up inspection/UI surfaces that assume runtime-owned attention ingress.
- Affected runtime laws: attention persistence, runtime ingress routing, follow-up scheduling, cold-start recovery, and companion lifecycle projection.
- Verification impact: requires new BDD coverage at attention-system, message-system, and app-server integration boundaries plus explicit review checkpoints in the OpenSpec task plan.
