## Context

The runtime Heartbeat stream is no longer a generic conversation transcript. It is an inspection surface over durable `message-parts`, request-aux facts, and model lifecycle rows. The current implementation still reuses chat-first ai-elements message wrappers for normal Heartbeat entries, which creates the wrong visual ownership:

- `user` rows inherit the general-purpose `bg-primary text-primary-foreground` chat bubble treatment.
- top metadata repeats role-derived facts and low-signal counters like `round 0`.
- part-level cards still show `Text` as if it were meaningful operator metadata.
- avatars fall back to initials instead of using the session's actual Avatar image.

The new structured-value viewer also needs one additional contract correction: a viewer without a local override should track global mode changes immediately, while a local override should be ephemeral and tied only to the current mounted DOM instance.

## Goals / Non-Goals

**Goals:**

- Make Heartbeat rows read like inspection entries, not social chat bubbles.
- Remove redundant metadata and low-signal chips from the Heartbeat stream.
- Ensure structured payload content stays readable against inspection surfaces.
- Bind Heartbeat row avatars to the AvatarSession icon already used elsewhere in the runtime shell.
- Keep `JsonViewer` local overrides ephemeral and global changes live.
- Record the ai-elements-svelte LLM docs URL in durable repo guidance.

**Non-Goals:**

- Redesign the whole ai-elements message system for chat routes.
- Change backend Heartbeat payloads or database schema.
- Introduce persistent per-row local viewer preferences across remounts.

## Decisions

### 1. Heartbeat rows stop using chat bubble semantics for primary framing

Decision:
`runtime-heartbeat-entry.svelte` will keep ai-elements where they help with composition, but Heartbeat rows will no longer inherit the chat `user -> bg-primary` semantic surface. The entry itself owns an inspection-row surface with neutral readable tones.

Rationale:
- Heartbeat is a technical inspection stream, not a direct user-facing conversation.
- The existing chat palette makes structured payloads unreadable and visually misleading.

Alternative considered:
- Keep the existing bubble and only tweak colors.
  Rejected because the wrong semantics would remain encoded in the component choice.

### 2. Metadata stays factual and sparse

Decision:
Heartbeat row headers will keep only high-signal durable facts, primarily `call #` and timestamp, plus exceptional state like `streaming` when needed. Repeated role chips, `round 0`, and `Text` part labels are removed from normal presentation.

Rationale:
- Operators need scan efficiency, not redundant labeling.
- `role=user` is already visible from alignment and avatar ownership.

### 3. AvatarSession icon is the canonical Heartbeat avatar

Decision:
The runtime shell will pass the session icon URL into Heartbeat entries, and Heartbeat avatars will use that image instead of fallback initials.

Rationale:
- The runtime shell is avatar-centric.
- The current `YO` fallback misrepresents the row identity and wastes available profile media.

### 4. Local structured-viewer mode remains DOM-local only

Decision:
A viewer without a local override follows the global subscription immediately. A local override remains in component-local state and is mirrored only as a DOM dataset fact, so remount resets back to the current global mode.

Rationale:
- This matches the user's requested interaction contract.
- It avoids adding another persistence layer for something that should stay ephemeral.

## Risks / Trade-offs

- [Heartbeat rows become less obviously "chat-like"] → This is intentional; the route is an inspection surface, and metadata plus alignment still preserve chronology.
- [Using the session icon for all Heartbeat rows may blur actor distinctions] → Alignment and row content still distinguish request-side versus assistant-side facts, while the avatar now correctly anchors the runtime identity.
- [Removing `round` or `Text` chips could hide debugging data] → Those facts remain available in durable payload content or clipboard export; they no longer consume the default visual scan path.
