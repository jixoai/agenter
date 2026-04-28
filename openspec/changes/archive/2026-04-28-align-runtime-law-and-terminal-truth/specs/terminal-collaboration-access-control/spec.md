## MODIFIED Requirements

### Requirement: Terminal administration SHALL elect one current admin from an ordered admin group
Each terminal SHALL expose one current local admin at a time, while an ordered admin-group candidate list MAY be configured behind it. The ordered candidate list SHALL be stored in the canonical terminal admin-candidate table rather than duplicated in terminal metadata. When the current admin goes offline, the next eligible candidate in order SHALL be promoted, and any still-pending approval work SHALL be reassigned to the newly promoted admin. If a higher-priority eligible candidate later comes online, it SHALL immediately preempt and become the current admin.

#### Scenario: Offline admin hands off to the next candidate
- **WHEN** the current terminal admin goes offline and a lower-ranked eligible candidate is available
- **THEN** the control plane promotes the next eligible candidate to current admin
- **THEN** unresolved approval requests are reassigned to that promoted admin

#### Scenario: Higher-priority candidate preempts when it returns
- **WHEN** a higher-priority eligible candidate in the admin group comes online while a lower-priority admin is currently active
- **THEN** the higher-priority candidate immediately becomes the current admin
- **THEN** unresolved approval requests are re-forwarded to the newly promoted admin

#### Scenario: Admin group candidates do not mirror into terminal metadata
- **WHEN** terminal administration updates the ordered admin group candidates
- **THEN** the control plane persists the order in the canonical admin-candidate table
- **AND** the terminal catalog metadata does not gain an `adminGroupCandidateIds` mirror
