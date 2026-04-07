## Context

The shared `web-chat-view` row renders whatever `subtitle` the host provides in `WebChatActorPresentation`. In Message-system, that subtitle currently comes directly from the room seat projection, which often uses workspace paths or actor ids for selector disambiguation.

That is the wrong surface boundary. Selectors and management panels need rich disambiguation. The primary transcript should stay quiet unless two visible actors would otherwise collapse into the same name.

## Goals / Non-Goals

**Goals**

- Keep unique human-readable sender rows visually quiet in the transcript.
- Preserve disambiguation when duplicate visible labels exist.
- Keep the fix in Message-system host projection instead of weakening shared chat primitives.

**Non-Goals**

- Redesign message row chrome in `web-chat-view`.
- Remove subtitles from management dialogs or selectors.
- Change actor identity storage or canonical label resolution.

## Decisions

### Message-system owns transcript subtitle filtering

The host route already decides actor presentation for transcript rows and read disclosures. It will now explicitly decide whether a subtitle is visible instead of forwarding selector detail blindly.

### Subtitle visibility is duplicate-label driven

If a room seat's visible label is unique within the current room seat set, transcript rows and read disclosures will omit its subtitle. If duplicate labels exist, the subtitle remains visible so the operator can still distinguish actors.

## Risks / Trade-offs

- [Risk] Operators may want technical detail always visible in the transcript. -> Mitigation: selectors, management views, and context actions still keep that detail.
- [Risk] Duplicate-label detection could drift from other selector logic. -> Mitigation: both transcript and selector paths will reuse the same duplicate-label truth already computed in `message-system-surface`.
