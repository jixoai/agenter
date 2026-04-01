## MODIFIED Requirements

### Requirement: Compact ready replies SHALL remain reusable after compaction

Compact summaries SHALL preserve resolved cross-room or chat-backed answers as structured ready-reply facts so a later follow-up can answer directly without reopening the resolved relay. Tool-derived ready-reply facts SHALL keep the channel-local trigger provenance that actually preceded the dispatched reply, rather than inheriting later focused questions from the same channel.

#### Scenario: Follow-up reuses a compacted relay answer

- **WHEN** compacted memory contains a ready-reply fact whose `topic` or `triggerPhrases` match a later follow-up
- **THEN** the next normal model round can directly dispatch that fact's `reply` to that fact's `channelId`
- **THEN** it does not need to reopen the old relay before settling the new attention item

#### Scenario: Multiple channel topics keep separate ready-reply provenance

- **GIVEN** one focused channel already received a lunch answer and later a weather answer before compact
- **WHEN** compact derives ready-reply facts from prior `message_send` history
- **THEN** the lunch reply keeps lunch trigger phrases and the weather reply keeps weather trigger phrases
- **AND** a later weather follow-up does not match the preserved lunch reply
