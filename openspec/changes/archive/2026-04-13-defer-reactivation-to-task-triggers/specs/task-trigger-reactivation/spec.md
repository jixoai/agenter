## ADDED Requirements

### Requirement: Task triggers SHALL reactivate future work through committed attention items
The system SHALL provide a task/trigger capability that can encode future reactivation conditions and, when those conditions are met, reintroduce work into the runtime by committing new attention items.

#### Scenario: Time-based reminder reactivates work later
- **WHEN** an avatar delegates a future reminder such as "every day at 5:00 remind the user to wake up"
- **THEN** the task/trigger capability records that future condition as durable trigger state
- **THEN** when the trigger fires later, it commits one or more new attention items for the runtime instead of directly bypassing the attention system

### Requirement: Successful trigger delegation SHALL allow the current attention to settle
When the AI has successfully delegated a future obligation to the task/trigger capability, the current attention context SHALL be allowed to settle if no immediate work remains in the present round.

#### Scenario: Current round ends after durable trigger registration
- **WHEN** the AI confirms that a future trigger has been durably registered
- **AND** no immediate user-visible follow-up remains in the current round
- **THEN** the AI may commit the current attention as done
- **THEN** the future work is represented by the trigger's later attention reactivation instead of by keeping the current debt active
