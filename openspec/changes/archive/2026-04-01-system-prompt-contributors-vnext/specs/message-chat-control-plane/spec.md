## ADDED Requirements

### Requirement: Message-system SHALL define communication semantics for model work

The message control plane SHALL contribute provider-owned system guidance that describes message-system as an asynchronous multi-channel communication surface. That guidance SHALL teach role-aware dispatch instead of reducing message tools to mechanical quote forwarding.

#### Scenario: Prompt guide teaches role-aware relay

- **WHEN** a model call includes message-system tools
- **THEN** the system prompt explains that the assistant must first decide whether it is replying, relaying, judging, coordinating, or notifying
- **AND** relay messages are composed for the target participant instead of blindly copying the originating user's raw sentence

#### Scenario: Prompt guide preserves assistant role boundaries

- **WHEN** the assistant is asked to mediate or judge between channels
- **THEN** the system prompt reminds it not to speak as another participant
- **AND** lack of a user reply in one channel does not block unrelated work elsewhere in the runtime
