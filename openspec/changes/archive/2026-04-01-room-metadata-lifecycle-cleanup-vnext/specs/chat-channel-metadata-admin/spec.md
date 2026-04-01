## MODIFIED Requirements

### Requirement: Admin access SHALL mutate chat-channel metadata

A caller with current room-admin access SHALL be able to update mutable global room metadata, including title, room metadata fields, participant actor bindings, and the ordered room admin-group candidate list, while non-admin callers remain read-only for those concerns.

#### Scenario: Passive refresh does not discard an in-progress admin edit
- **WHEN** the metadata disclosure rerenders because the room list polled again but the durable room revision did not change
- **THEN** any unsaved title, participant, or metadata draft already entered by the admin remains intact
- **AND** the disclosure only resyncs from server truth after a real room revision change
