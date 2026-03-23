## Purpose

Define the shared WebUI layout review prompt, evidence, and scorecard contract.

## Requirements

### Requirement: WebUI layout reviews SHALL use a shared prompt and scorecard contract
The repository SHALL provide a shared WebUI generation and review prompt plus a scorecard contract so future shell and page-surface changes are judged against the same density, hierarchy, and compact-layout expectations.

#### Scenario: Review prompt evaluates a shell or layout change
- **WHEN** a human or AI reviews a WebUI shell or page-surface change
- **THEN** the review can use one repository-defined prompt and rubric instead of inventing local criteria
- **THEN** the prompt explicitly covers hierarchy, padding density, action priority, tooltip usage, and compact viewport behavior

### Requirement: Layout evidence SHALL include screenshots and measurable DOM geometry
The WebUI review flow SHALL produce objective evidence for layout review, including screenshots and measurable DOM geometry for key compact and desktop stories.

#### Scenario: Storybook audit emits evidence for compact and desktop layouts
- **WHEN** Storybook DOM or browser review runs against a layout-sensitive story
- **THEN** the evidence includes desktop and compact screenshots
- **THEN** the evidence also includes measurable geometry such as row count, overlap checks, and major surface heights

### Requirement: Storybook layout verification SHALL be component-first before route assembly
The WebUI layout review flow SHALL lock primitive layout contracts before relying on composite or page-level assembly stories. Chat and shell changes SHALL add or update primitive stories for the affected leaf layout components before route assembly stories are treated as the final acceptance gate.

#### Scenario: A compact shell change touches shared layout primitives
- **WHEN** a Chat or shell layout change modifies a shared leaf component such as an adaptive button, passive signal, session pill, or composer row
- **THEN** the change includes a dedicated Storybook story and DOM contract for that primitive
- **THEN** page or route assembly stories are used only after the primitive contract is already passing

### Requirement: Layout reviews SHALL support mixed human-and-model scoring
The review contract SHALL support mixed scoring where automated checks produce metrics and screenshots, and a human or AI uses that evidence to produce the final qualitative score.

#### Scenario: Objective evidence feeds the final scorecard
- **WHEN** automated checks finish for a WebUI layout review
- **THEN** they provide the numbers and screenshots needed for a human or AI to complete the scorecard
- **THEN** the final review does not depend on pure pixel-diff automation alone
