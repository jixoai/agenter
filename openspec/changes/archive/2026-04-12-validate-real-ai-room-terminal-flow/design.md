## Context

`packages/app-server` already has a real-provider harness (`createRealKernelHarness`) plus several opt-in LoopBus scenarios that prove isolated behaviors such as simple room reply, relay through a second room, terminal-backed fact gathering, and interleaved user input. What is still missing is the most product-shaped backend acceptance path: a user asks one Avatar to build a tiny app, the Avatar uses terminal tools to create and launch it, delivers the URL through the room, receives feedback, and improves the delivered app without leaving the same conversation.

This change must stay backend-only. It should not depend on WebUI, and it should not invent a second truth source for runtime state. The scenario must read durable room truth, recent model-call traces, terminal-backed side effects, and real HTTP responses from the delivered URL.

## Goals / Non-Goals

**Goals:**
- Add one opt-in real-provider scenario that validates room messaging, terminal execution, local HTTP delivery, and one feedback iteration together.
- Reuse the existing real harness and polling primitives instead of introducing a separate end-to-end stack.
- Make the scenario deterministic enough to assert success from room truth, fetched HTTP content, and model-call traces.
- Emit concrete backend evidence when the run fails so regressions can be debugged without WebUI.

**Non-Goals:**
- Do not implement the later two-Avatar project-room collaboration scenario in this change.
- Do not add a browser/UI harness.
- Do not expand product behavior beyond what existing room, terminal, and runtime contracts already support.

## Decisions

### 1. Reuse the existing real kernel harness as the single execution surface
The scenario will be implemented inside `packages/app-server/test-support/real-loopbus-scenarios.ts` and executed through the existing real harness and opt-in real integration tests.

Alternative considered:
- Add a separate CLI-only driver on top of tRPC.

Why not:
- The existing harness already gives direct access to room truth, attention inspection, and model debug records. Rebuilding those observability paths in a separate driver would duplicate backend truth and slow iteration.

### 2. Use a deterministic “tiny app delivery protocol” inside the prompt
The test prompt will instruct the Avatar to:
- acknowledge the request in the primary room,
- create a tiny static app with deterministic v1 markers,
- launch it on a preallocated `127.0.0.1` port through terminal tools,
- verify it locally,
- send exactly one room-visible delivery message containing `APP-URL: <url>`.

The feedback round will then require deterministic v2 markers on the same delivered URL.

Alternative considered:
- Let the Avatar freely choose the app stack, port, and response wording.

Why not:
- The goal is validating system behavior, not model creativity. Loose prompts would make failures ambiguous and turn the test into prompt roulette.

### 3. Verify delivery through real HTTP fetches instead of terminal transcripts alone
After the Avatar reports the URL, the harness will perform a real HTTP GET and assert the delivered body contains deterministic markers. After simulated user feedback, the harness will fetch again and assert the updated markers.

Alternative considered:
- Trust terminal output or room text alone.

Why not:
- A room-visible URL is only meaningful if the service is actually reachable and serves the expected content.

### 4. Treat model-call tool traces and attention convergence as success criteria
Successful completion must prove more than “a message appeared”. The scenario will also assert:
- recent model-call traces include `message_send` and at least one `terminal_*` tool,
- validation-scoped attention contexts settle back to zero after delivery and after feedback.

Alternative considered:
- Assert only room messages and HTTP fetches.

Why not:
- That would miss regressions where the model skipped terminal work or left unresolved attention debt behind.

### 5. Fail with backend evidence, not vague timeout text
On failure, the scenario runner should dump the primary facts needed for debugging: room truth messages, recent model calls, the last resolved URL, the latest fetched HTTP body or fetch error, and any directly inspectable terminal state that already exists in kernel APIs.

Alternative considered:
- Rely on generic test timeout output.

Why not:
- Real-provider failures are expensive. Each failed run must leave enough evidence to decide whether the regression is prompt, runtime, provider, or terminal related.

## Risks / Trade-offs

- [Prompt brittleness against provider variance] → Keep the protocol small, marker-based, and operationally explicit; avoid open-ended product requests.
- [Long-running local HTTP process may not stay up] → Preallocate the port, instruct the Avatar to verify the URL before replying, and fetch immediately after delivery.
- [Real-provider flakiness can create false negatives] → Keep the scenario opt-in under the existing real-provider gate and collect rich failure evidence for triage.
- [Overfitting to one tiny app] → Accept this trade-off for the first validation slice; broader multi-Avatar collaboration remains a separate change.
