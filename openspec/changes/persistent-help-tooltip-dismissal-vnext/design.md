## Context

We need one orthogonal primitive for contextual help that can be mounted anywhere without embedding panel-specific state machines. The primitive must support:

- First-visit onboarding visibility (auto-open).
- User-controlled dismissal that persists across reloads.
- Continued discoverability (hover/click) after dismissal.

## Decisions

### Help hint primitive

- Introduce `HelpHint` as a reusable trigger + tooltip popup contract.
- The trigger is always a compact `?` affordance.
- `HelpHint` is controlled (explicit `open` state) so onboarding and dismissal behavior are deterministic.

### Persistence contract

- Store dismissal state through `idb-keyval`.
- Key format: `agenter:webui:help:dismissed:v1:<digest>`.
- Digest seed: normalized `textContext`, optionally prefixed with `helpId`.
- Digest algorithm:
  - Primary: `crypto.subtle.digest("SHA-256")`.
  - Fallback: deterministic non-crypto hash when subtle crypto is unavailable.

### Interaction contract

- If not dismissed:
  - tooltip opens automatically on mount.
  - first click on `?` dismisses and closes.
- If dismissed:
  - hover and click can open/close tooltip normally.

### Adoption scope in this change

- Dialog header descriptions.
- Settings, quick-start, cycle/model/devtools panel helper copy.
- Composer helper surface (replace inline helper chips with `HelpHint` content).
- Additional technical panels with persistent helper one-liners (Systems, Attention, Terminal Activity).

### Verification strategy

- Unit test for key stability + persisted dismissal readback.
- Storybook DOM updates for composer status/toolbar interactions.
- Existing WebUI unit + DOM suites must remain green.
