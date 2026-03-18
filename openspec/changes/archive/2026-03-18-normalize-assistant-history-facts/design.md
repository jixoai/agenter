## Context

`AgenterAI` already has one path that produces factual `ChatMessage[]` for WebUI/chat rendering and another path that flattens the same turn into a single assistant history blob for model replay. The second path injects headings (`Replies`, `Notes`, `Tool activity`) and compresses multiple semantics into one string, which violates the project rule that the runtime must expose objective facts and let the model reason over them directly.

The change is narrow in scope but crosses runtime behavior, model replay, i18n, and test contracts. It benefits from a short design so the implementation uses one fact source instead of two drifting formats.

## Goals / Non-Goals

**Goals:**

- Build one assistant fact sequence from `thinking`, `text`, `toolTrace`, and `attentionReplies`.
- Reuse that sequence for both chat-facing `ChatMessage[]` output and model-history replay.
- Preserve factual ordering: self-talk, tool call/result pairs, and user-facing replies stay in the same order everywhere.
- Remove synthetic assistant-history headings and their i18n surface.

**Non-Goals:**

- Changing provider request structure beyond assistant history content.
- Reformatting or sanitizing assistant/tool payload text.
- Introducing backward-compatibility shims for the old replay format.

## Decisions

- Use a single helper that returns structured assistant facts.
  - Rationale: this removes duplicated sequencing logic and keeps chat output and model replay aligned.
  - Alternative rejected: keep separate builders and “sync” them with tests; this preserves duplication and invites drift.
- Replay each fact as its own assistant model message.
  - Rationale: model history should mirror observable runtime events, not a synthesized document.
  - Alternative rejected: concatenate facts into one assistant message without headings; it still collapses event boundaries and makes future rollback/retry semantics harder.
- Delete obsolete runtime text keys instead of leaving dead strings.
  - Rationale: the headings are no longer valid behavior, so keeping them violates YAGNI and creates false i18n surface.

## Risks / Trade-offs

- [More assistant messages per turn] -> Acceptable because the message count reflects reality and the project already favors factual logs over synthetic summaries.
- [Tests may rely on old headings indirectly] -> Update the BDD contract to assert ordering and raw fenced tool payloads instead.
- [Minor history-shape change for model providers] -> Safe because the content becomes less lossy and more objective, which matches the current architecture direction.
