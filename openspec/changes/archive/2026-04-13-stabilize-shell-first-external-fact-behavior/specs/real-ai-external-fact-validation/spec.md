## ADDED Requirements

### Requirement: Real-provider external-fact validation SHALL use a dedicated test Avatar
The backend real-provider validation suite SHALL run shell-first external-fact scenarios with a dedicated test Avatar and a dedicated `AGENTER.mdx`, instead of relying on the shared default Avatar prompt state.

#### Scenario: External-fact scenario mounts a test-only Avatar persona
- **WHEN** the real-provider validation suite starts an external-fact scenario
- **THEN** it creates or reuses a test-only Avatar fixture for that suite
- **AND** that Avatar reads its own dedicated `AGENTER.mdx`
- **AND** the scenario does not depend on shared default Avatar prompt drift

### Requirement: Real-provider external-fact validation SHALL prove shell-first behavior before semantic success
The external-fact scenario SHALL prove that the Avatar acknowledges the request, uses `root_workspace_bash` during objective fact gathering, then returns a semantically correct answer and settles attention.

#### Scenario: Weather-style external fact task converges through shell-first verification
- **WHEN** the user asks a test Avatar for a current or forecast external fact that cannot be answered safely from memory
- **THEN** the scenario observes a short acknowledgement
- **AND** recent model-call tool traces include `root_workspace_bash`
- **AND** the final answer passes semantic validation for the requested fact
- **AND** attention settles after the reply

### Requirement: External-fact validation failures SHALL expose durable diagnostics
When a real-provider external-fact scenario times out or fails, the suite SHALL emit durable diagnostics rich enough to distinguish prompt-law failure, skill-law failure, provider latency, and runtime execution issues.

#### Scenario: Timeout output includes prompt/avatar and shell evidence
- **WHEN** an external-fact scenario stalls or times out
- **THEN** the failing run reports room truth messages, recent model calls, tool trace evidence, and the test Avatar / prompt source identity
- **AND** the output is sufficient to debug whether the failure came from persona shaping, shell usage, or provider/runtime behavior
