## Context

The current repository already proves parts of the LoopBus architecture with `real-loopbus` integration tests, but those tests depend on an external provider and use a direct injected participant reply. That leaves two gaps:

1. The acceptance path is not deterministic enough for repeated regression work.
2. The runtime is not yet covered by a non-GUI scenario that starts from a real session, manually configures two rooms, performs a relay, triggers `/compact`, and validates the follow-up answer.

The user request also constrains the architecture: do less, keep the platform rules clean, and verify behavior through LoopBus/message protocols instead of GUI or special-case hooks.

## Goals / Non-Goals

**Goals:**

- Prove a real `AppKernel -> SessionRuntime -> LoopBus -> AgenterAI` path can relay from `kzf` in room 1 to `gaubee` in room 2 and back.
- Keep the test deterministic by replacing external AI variance with a local rule-based completion provider.
- Verify manual compact produces a real compact cycle and preserves the factual room history needed for the next answer.
- Assert only public or durable facts: chat messages, attention state, model debug, and cycle projections.

**Non-Goals:**

- No GUI, browser, or WebUI coverage in this change.
- No general multi-agent framework beyond the protocol already exposed by rooms and message channels.
- No provider abstraction redesign unless the new regressions prove the existing rule is insufficient.

## Decisions

### Use a deterministic local completion provider behind the existing provider contract

The harness will write workspace settings that point `AppKernel` at a local OpenAI-completion-compatible test server. This keeps the runtime on the real model-client path, including compact summarization, without depending on an external network model.

Alternative considered:
- Mock `ModelClient` directly inside the runtime. Rejected because it bypasses provider resolution, request persistence, and compact summarize behavior that the user explicitly wants exercised.

### Keep rooms as message-system channels, not a new room abstraction

The test will manually create two message channels and treat them as rooms:
- room 1: the default main chat for `kzf`
- room 2: a manually created channel for `gaubee`

This follows the existing platform rule that rooms are message control-plane entries rather than a separate bespoke subsystem.

Alternative considered:
- Introduce a test-only room wrapper type. Rejected because it adds another abstraction layer and increases coupling without adding capability.

### Implement temporary `gaubee` AI as a test-side responder bound to room 2

The user explicitly allows a temporary AI to replace `gaubee`. The smallest orthogonal implementation is a watcher/helper that listens for the room-2 prompt and responds with `中午吃蛋炒饭。` through the authorized channel API. This preserves the message protocol without forcing a second full runtime.

Alternative considered:
- Boot a second full session/runtime for `gaubee`. Rejected for now because it introduces more moving parts than the acceptance criteria require.

### Verify compact through cycle facts plus follow-up behavior

The second scenario will trigger `/compact`, assert the session records a `compact` cycle with `compactTrigger: "manual"`, and then ask `中午吃什么`. The test will pass only if the answer returns correctly on the main room without re-running the relay.

Alternative considered:
- Only assert summarize input or internal compact flags. Rejected because the user cares about the surviving behavior, not only the internal signal.

## Risks / Trade-offs

- [Risk] Prompt-matching in the mock provider becomes brittle if runtime prompts change too much. → Mitigation: route on stable observable facts in the serialized prompt, and keep assertions focused on user-visible messages.
- [Risk] Existing dirty worktree changes in LoopBus/attention code can intersect with this work. → Mitigation: restrict edits to new harness/tests and only touch runtime code if the deterministic tests expose a real platform gap.
- [Risk] Manual compact may already work, but the follow-up answer could depend on accidental history ordering. → Mitigation: assert the compact cycle and the post-compact answer together to catch hidden replay regressions.
