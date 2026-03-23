## MODIFIED Requirements

### Requirement: Workspace Chat SHALL expose one primary session action and one actionable status summary
The WebUI SHALL expose exactly one primary session action inside the Chat route, and it SHALL summarize route-relevant runtime state into one actionable notice or passive status instead of stacking multiple competing technical statuses. The primary session action SHALL be rendered through one compact route-local status pill menu rather than through header-level action chrome.

#### Scenario: Stopped session offers one clear recovery path
- **WHEN** the active session is stopped
- **THEN** the Chat route shows one route-local session status pill that exposes the start action
- **THEN** the surrounding status copy explains the most relevant next step without simultaneously repeating multiple raw runtime states

#### Scenario: Route summary prefers actionable guidance over vague fallback errors
- **WHEN** the Chat route receives an unclassified or generic error condition
- **THEN** the route renders a stable user-facing summary instead of the raw text `Unknown error`
- **THEN** the summary either offers a recovery action or explains what part of the session failed in neutral language

#### Scenario: Session controls do not expand the top header
- **WHEN** the user opens a workspace Chat route with an active session
- **THEN** the top header stays passive and compact
- **THEN** start, stop, resume, and abort controls stay inside the route-local session status pill menu
