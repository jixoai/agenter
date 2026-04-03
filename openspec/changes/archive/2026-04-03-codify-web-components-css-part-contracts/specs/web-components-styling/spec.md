## ADDED Requirements

### Requirement: Lit web-components SHALL expose stable styling slots through css-part

Framework-agnostic Lit atoms in `@agenter/web-components` SHALL expose stable visual slots through `css-part` whenever their visible surfaces need downstream theming. Product clients such as the Svelte WebUI MAY style those slots through `::part(...)` or Tailwind part selectors, but they MUST NOT depend on shadow-private class names.

#### Scenario: Product skin styles a Lit atom without shadow-private selectors
- **WHEN** a client needs to theme a Lit atom implemented in `@agenter/web-components`
- **THEN** the client styles stable `::part(...)` selectors instead of internal class names
- **THEN** the atom remains reusable across multiple clients without duplicating implementation

#### Scenario: Shared durable atoms expose their primary surfaces
- **WHEN** a client consumes durable shared atoms such as `adaptive-icon-button`, `async-surface`, `json-viewer`, `markdown-document`, or `tool-invocation-card`
- **THEN** each atom exposes stable top-level `part` names for its primary visual surfaces
- **THEN** the client does not need to reopen shadow-private class names to restyle the atom

### Requirement: Stateful external theming SHALL use host-reflected facts

If a Lit atom requires stateful theming from the outside, the host SHALL reflect the relevant state so outer `::part(...)` rules can key off durable facts instead of shadow-private selectors.

#### Scenario: HelpHint exposes factual presentation state for popup theming
- **WHEN** HelpHint is closed, passively auto-opened, or actively open
- **THEN** the host reflects that factual presentation state
- **THEN** outer clients can theme `::part(trigger)` and `::part(popup)` based on the host state without reopening shadow internals
