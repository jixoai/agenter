# terminal-session-projection Specification

## Purpose
Define how session runtimes project global terminal truth into session facts without duplicating terminal-owned history.

## Requirements
### Requirement: Session runtimes SHALL persist terminal references instead of duplicating terminal truth
Session runtimes SHALL record terminal-event refs, focus bindings, and approval-subscription metadata needed for runtime reasoning, but they SHALL NOT persist full copies of global terminal history as session-owned source records.

#### Scenario: Cycle observes terminal activity
- **WHEN** a session cycle consumes or references activity from an attached terminal
- **THEN** the session fact store records the terminal id and referenced event identity
- **THEN** the full terminal activity remains owned by the global terminal authority

#### Scenario: Session stop does not delete attached terminal truth
- **WHEN** a session attached to one or more terminals stops or is deleted
- **THEN** app-server removes only the session-owned bindings and projections
- **THEN** the underlying terminal truth, grants, and history remain intact

### Requirement: Session actors MAY receive terminal approval work through attention
When a session actor is one of the administrators for a terminal, terminal approval requests MAY be projected into that session's attention system for handling, but the approval request lifecycle SHALL remain owned by the terminal authority.

#### Scenario: Session admin receives approval work through attention
- **WHEN** a session actor is configured as a terminal admin and a requester creates a write approval request
- **THEN** the session may receive an attention item pointing to that request
- **THEN** the terminal authority still owns the canonical approval status and timeout
