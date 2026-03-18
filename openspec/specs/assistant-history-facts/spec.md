## Purpose

Define the factual assistant-history replay contract used by model history and chat rendering.

## Requirements

### Requirement: Assistant history replay preserves factual message boundaries

The system SHALL replay one assistant turn into model history as the same factual message sequence used for chat rendering, without adding synthetic headings, summaries, or category labels.

#### Scenario: Self-talk and replies are replayed as facts

- **WHEN** one assistant turn contains self-talk text and one or more user-facing replies
- **THEN** the replayed assistant history contains separate assistant messages for those facts
- **THEN** none of those messages contain synthetic headings such as `### Replies`, `### Notes`, or `### Tool activity`

### Requirement: Tool activity remains raw structured content

The system SHALL preserve tool activity in replayed assistant history as raw structured fenced content using the same `yaml+tool_call` and `yaml+tool_result` payloads exposed to chat rendering.

#### Scenario: Tool call and result are preserved in order

- **WHEN** one assistant turn records a tool call and its result
- **THEN** the replayed assistant history contains the `yaml+tool_call` fenced block before the matching `yaml+tool_result` fenced block
- **THEN** the tool payload content remains factual and unwrapped by explanatory prose

### Requirement: Assistant history ordering matches runtime fact ordering

The system SHALL preserve fact ordering consistently between chat output generation and model-history replay.

#### Scenario: Mixed assistant facts stay aligned

- **WHEN** one assistant turn contains self-talk, tool activity, and a user-facing reply
- **THEN** chat output and replayed assistant history expose those facts in the same order
