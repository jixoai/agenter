## MODIFIED Requirements

### Requirement: WebUI layout reviews SHALL use a shared prompt and scorecard contract
The repository SHALL provide a shared WebUI generation and review prompt plus a scorecard contract so future shell and page-surface changes are judged against the same density, hierarchy, and compact-layout expectations. The prompt MUST explicitly cover hierarchy, padding density, action priority, tooltip usage, compact viewport behavior, shared async-surface states, adaptive icon-only spacing, and passive signal disclosures.

#### Scenario: Review prompt evaluates a shell or layout change
- **WHEN** a human or AI reviews a WebUI shell or page-surface change
- **THEN** the review can use one repository-defined prompt and rubric instead of inventing local criteria
- **THEN** the prompt explicitly covers hierarchy, padding density, action priority, tooltip usage, and compact viewport behavior
- **THEN** the reviewer can score async loading treatment and passive-signal usage from the same rubric

### Requirement: Storybook layout verification SHALL be component-first before route assembly
The WebUI layout review flow SHALL lock primitive layout contracts before relying on composite or page-level assembly stories. Chat and shell changes SHALL add or update primitive stories for the affected leaf layout components before route assembly stories are treated as the final acceptance gate. Adaptive affordances, async list surfaces, passive signal disclosures, and compact status triggers SHALL all be considered primitive contracts.

#### Scenario: A compact shell change touches shared layout primitives
- **WHEN** a Chat or shell layout change modifies a shared leaf component such as an adaptive button, passive signal, session status trigger, async list surface, or composer row
- **THEN** the change includes a dedicated Storybook story and DOM contract for that primitive
- **THEN** page or route assembly stories are used only after the primitive contract is already passing
