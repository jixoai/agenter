## ADDED Requirements

### Requirement: Cycle detail SHALL separate bridge hook outcomes from delivery receipts
The Devtools cycle detail surface SHALL expose attention hook outcomes and attention delivery receipts as separate inspection sections so operators can distinguish system-bridge behavior from AI delivery truth.

#### Scenario: Selected cycle shows both hook outcomes and receipt history
- **WHEN** the operator selects a cycle that committed or dispatched attention-backed work
- **THEN** the detail surface shows hook outcomes in one section
- **AND** it shows delivery receipts in a separate section keyed by commit or attempt identity

#### Scenario: Receipt failure is visible even when hooks succeeded
- **WHEN** commit or dispatch hooks succeed but the first observable provider outcome is an error
- **THEN** the hook-outcome section still shows successful bridge work
- **AND** the delivery-receipt section shows the failed delivery attempt explicitly

### Requirement: Cycle detail SHALL expose delivery attempt progression for retried work
The Devtools cycle detail surface SHALL preserve delivery attempt history for retried attention-backed work instead of collapsing all attempts into one generic cycle outcome.

#### Scenario: Retried commit shows multiple delivery attempts
- **WHEN** one attention commit is retried across more than one cycle or model attempt
- **THEN** the Devtools detail surface shows each delivery attempt and its receipts separately
- **AND** operators can inspect which attempt first accepted or failed
