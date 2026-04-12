> Status: Superseded on 2026-04-13 by the later focus law that keeps `focused` and `background` contexts wakeable, keeps `muted` silent by default, and treats notification-class ingress as the explicit override.

## Why

当前内核仍然把 `score > 0` 和后续自动唤醒强绑定：attention debt 不只是“义务仍然存在”，还会通过内建 timer/backoff 驱动 LoopBus 继续运行。这让 LoopBus 被迫承担“现在有没有必要再跑一次”这类高阶编排判断，而这并不是它应该长期拥有的能力。

未来真正需要的是把“义务存在”和“何时再次唤醒”拆开：LoopBus 只保持 attention-first 的生命体征，后续重激活交给 `taskSystem` 这类规划/触发系统建模。AI 可以把未来动作委托给 trigger/task，然后安全地把当前 debt 收尾；等触发条件满足时，再由 task system 提交新的 attention item 唤醒 runtime。

## What Changes

- **BREAKING**：修改 runtime scheduling law，`score > 0` 不再单独构成 LoopBus 自动重跑的充分条件。
- 新增 task-trigger reactivation contract：
  - task/trigger system 可以按时间、事件、或未来更复杂的判定条件安排一次后续重激活
  - trigger 命中时，通过 committed attention items 重新把 obligation 带回 runtime
- 明确 AI 使用法：
  - 当工作被成功委托给 future trigger/task 后，AI 可以收尾当前 attention
  - 真正的后续工作由 trigger 触发的新 attention item 重新唤醒
- 明确内核边界：
  - LoopBus 不负责高阶“必要性判断”
  - task/trigger system 才是未来 deferred reactivation 的编排面

## Capabilities

### New Capabilities
- `task-trigger-reactivation`: A planning/trigger capability that can schedule future reactivation and reintroduce work through committed attention items.

### Modified Capabilities
- `attention-runtime-scheduling`: Non-zero attention scores no longer auto-wake the loop by themselves; later rounds require an explicit runnable wake cause such as trigger fire, new ingress, or task event.

## Impact

- Affected code:
  - `packages/app-server/src/session-runtime.ts`
  - future `task-system` integration surfaces
  - runtime prompt / skill wording around debt vs reactivation
- Affected specs:
  - `openspec/specs/attention-runtime-scheduling/spec.md`
  - new `task-trigger-reactivation` capability
- Systems:
  - LoopBus runtime kernel
  - Attention scheduling law
  - future task/trigger planning system
