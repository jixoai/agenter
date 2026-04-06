## Context

The current control plane law is coherent: if the operator submits an empty room title, the room falls back to `Room`. The WebUI create route breaks that law at the presentation layer because the title input uses `Incident bridge` as placeholder copy, which reads like a default value even though it is never submitted.

This is a presentation-law mismatch, not a control-plane bug.

## Goals / Non-Goals

**Goals:**

- Make the `New room` title field objectively describe the actual empty-title result.
- Keep the existing server fallback title law unchanged.
- Add a regression test so the affordance does not drift away from the fallback title again.

**Non-Goals:**

- Changing the server default title away from `Room`.
- Introducing generated sample titles or auto-filled titles.
- Redesigning the entire `New room` form.

## Decisions

### 1. Treat the empty-title outcome as a durable fact

The UI should not pretend an example string is a default. If leaving the field blank produces `Room`, the create route should say so directly.

### 2. Keep the field empty by default

The route keeps the title input empty so operators can create rooms quickly or type a real title. The fix is in copy, not by force-filling the input with an example title.

### 3. Lock the affordance with a route-level regression check

The existing contract test for room creation already guards route-by-id behavior. Extend route-level coverage so the title field copy stays aligned with the fallback title law.

## Risks / Trade-offs

- [Risk] More literal copy may feel less polished than an example title. → Mitigation: keep the helper concise and objective.
- [Risk] Future changes to the server fallback title could desync the route again. → Mitigation: capture the fallback in regression coverage near the route source.
