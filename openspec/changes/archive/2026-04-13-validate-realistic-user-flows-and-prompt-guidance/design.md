## Context

The current real-provider suite already proves three hard properties:

- one Avatar can deliver a tiny app through room + terminal,
- the same Avatar can survive a cold restart and continue from disk-backed truth,
- two Avatars can collaborate in one project room with attachment handoff and final delivery.

The weakness is elsewhere: the user-side prompts in those validations still over-specify the delivery script. They tell the model exactly what acknowledgement prefix to send, when to create or reuse a terminal, how to answer in the room, and which intermediate coordination messages must appear. That makes the tests easier to automate, but it does not prove that shared prompt law plus system guides are strong enough for ordinary non-technical users.

This change therefore targets prompt law and acceptance style together:

- move more operational guidance into shared Avatar prompt docs and runtime system guides;
- reduce user instructions to realistic goals and feedback;
- keep tests deterministic by asserting durable outcomes and room facts rather than scripted user wording.

## Goals / Non-Goals

**Goals:**
- Make real-provider acceptance closer to everyday product usage by replacing step-by-step user scripts with ordinary-user requests.
- Strengthen shared Avatar prompt docs so Avatars act like proactive software-delivery agents, not passive command interpreters.
- Strengthen Message / Terminal / Workspace guides so the model knows how to self-recover resources and verify work without being told every step by the user.
- Preserve deterministic acceptance by checking delivery URLs, on-disk files, room truth, attachments, and tool traces.

**Non-Goals:**
- Do not replace the existing strongly-scripted scenarios; keep them as lower-level regression coverage.
- Do not introduce a new runtime prompt architecture such as pluggable `UsageExamplePrompt` registries in this change.
- Do not hardcode per-avatar runtime behavior in backend code paths; role preference must come from prompt law, not imperative branching.

## Decisions

### 1. Put ordinary-user delivery behavior into shared Avatar prompt docs

Shared prompt docs will explicitly teach three durable behaviors:

- translate vague or non-technical requests into a minimal viable software delivery plan;
- prefer delivering a small working version first and iterating from user feedback;
- ask clarifying questions only when the missing decision materially blocks delivery.

This keeps “how an Avatar behaves with ordinary users” inside prompt truth rather than inside scenario scripts.

Alternative considered:
- keep the shared prompts generic and continue teaching this only through scenario-specific user wording.

Why not:
- that would keep the product looking better in tests than in real use.

### 2. Express role preference through avatar-name heuristics, not runtime branching

The prompt layer will teach that an Avatar’s identity or nickname can imply a default professional bias:

- `backend` / `api` / `server` style names bias toward API/service ownership
- `frontend` / `ui` / `design` style names bias toward UI/design ownership
- general names remain full-stack generalists

This allows realistic two-Avatar collaboration without adding backend-side “if avatar is backend then...” glue.

Alternative considered:
- keep using private primer messages as the main role-definition mechanism.

Why not:
- primers are still test scaffolding. They are useful for certain edge cases, but they should not be the primary truth for everyday role behavior.

### 3. Strengthen dynamic system guides for self-service recovery

Message / Terminal / Workspace guides will become more explicit about operational behavior:

- Message: translate work back to ordinary users in plain language, coordinate clearly in shared rooms, and keep origin-room ownership.
- Terminal: if no terminal exists, create one; if one exists, recover it with `terminal_list` / `terminal_read` / `terminal_snapshot`; self-verify local delivery URLs before reporting success.
- Workspace: write real files into granted roots, treat mounted workspace as the actual project area, and avoid “code pasted in chat” as fake delivery.

Alternative considered:
- leave guides as-is and only strengthen `AGENTER_SYSTEM`.

Why not:
- guide content is where source-specific operational law belongs. Moving terminal/workspace usage into the global prompt would blur module boundaries.

### 4. New realistic-user validations will be outcome-driven, not script-driven

The new single-avatar and two-avatar scenarios will use ordinary-user language while still asserting deterministic outcomes:

- concrete user-visible strings in the delivered app;
- stable local delivery URL behavior;
- room-visible acknowledgement / coordination / delivery;
- attachment handoff for the multi-avatar case;
- tool traces showing real terminal and message usage.

The tests will not require rigid intermediate prefixes such as `APP-ACK:` or `BACKEND-CONTRACT:` from the user prompt.

Alternative considered:
- make the scenarios fully free-form and only inspect final room history manually.

Why not:
- that would make real-provider regression too noisy and too hard to diagnose in CI-like runs.

### 5. `UsageExamplePrompt` is explicitly deferred

If prompt-law tightening still proves insufficient, the next escalation path is a structured example layer, likely system-scoped and selectively injected. That is recorded as a future option only.

Alternative considered:
- introduce `UsageExamplePrompt` immediately.

Why not:
- it adds prompt-surface complexity before we know the simpler law tightening is insufficient.

## Risks / Trade-offs

- [Risk] Realistic-user prompts may expose current prompt weaknesses and make the suite fail more often. → Mitigation: keep the older scripted scenarios as baseline regressions and treat the new ones as higher-value acceptance gates.
- [Risk] Avatar-name specialization heuristics may be too weak for some models. → Mitigation: encode the bias clearly in shared prompt docs and validate it with the two-Avatar scenario.
- [Risk] More natural room messages are harder to assert deterministically. → Mitigation: assert durable outcomes plus broad room/tool evidence instead of brittle exact prose.
- [Risk] Shared prompt tightening could shift behavior in unrelated scenarios. → Mitigation: re-run existing single-avatar, cold-restart, and multi-avatar real-provider flows after the prompt change.

## Migration Plan

1. Add delta specs for prompt-law and realistic-user validation expectations.
2. Update localized shared prompt docs and runtime system-guide builders.
3. Add one realistic-user single-Avatar scenario/test.
4. Add one realistic-user two-Avatar collaboration scenario/test.
5. Re-run focused backend tests and the relevant real-provider flows.

Rollback strategy:

- revert the prompt-doc and scenario additions together if the prompt-law shift degrades the existing real-provider flows.

## Open Questions

- If the realistic-user tests still require too much hidden scaffolding, should `UsageExamplePrompt` become a first-class prompt source or a system-guide extension?
- Do we later want a per-avatar prompt overlay in the real-team harness, or is shared prompt law plus avatar-name specialization sufficient?
