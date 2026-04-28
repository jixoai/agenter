## MODIFIED Requirements

### Requirement: Runtime clients SHALL project Heartbeat into grouped inspection pages

Runtime inspection consumers SHALL read Heartbeat as grouped pages instead of directly rendering paged raw parts. The grouped page contract SHALL be served from bounded storage reads and SHALL NOT require full-session reconstruction before returning the recent page.

#### Scenario: Heartbeat recent page is served from bounded history

- **WHEN** the operator opens Heartbeat for a session with deep `ai_call`, `heartbeat_part`, and `request_aux` history
- **THEN** the backend reads only the storage window needed for the requested grouped page plus any minimal comparison baseline needed to preserve grouping truth
- **AND** it does not materialize the full session inspection history before returning the recent grouped page
- **AND** the returned groups still preserve `before-call`, `call`, `compact`, and `before-call-pending` semantics

#### Scenario: Loading older Heartbeat history expands by page instead of replaying all history

- **WHEN** the operator asks Heartbeat to load older grouped history
- **THEN** the backend expands the grouped query window only enough to satisfy that older page
- **AND** it does not rebuild the entire Heartbeat grouping for every pagination request

#### Scenario: Deep grouped Heartbeat history still settles route hydration

- **WHEN** the browser hydrates Heartbeat for a session with long inspection history
- **THEN** the grouped Heartbeat request resolves with data or an explicit error
- **AND** the operator does not remain indefinitely on `Loading Heartbeat…` because the backend is rebuilding full history in memory

#### Scenario: Heartbeat route hydrates only route-owned history

- **WHEN** the browser opens the Heartbeat route for a session with large persisted history
- **THEN** the route fetches grouped Heartbeat data plus the minimal model-call context needed by the Heartbeat status surface
- **AND** it does not piggyback `chat.list`, scheduler logs, observability traces, request-aux timelines, or API-call timelines onto the same cold start
