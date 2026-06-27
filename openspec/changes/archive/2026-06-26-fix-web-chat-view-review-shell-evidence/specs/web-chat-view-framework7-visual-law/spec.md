## MODIFIED Requirements

### Requirement: Visual review SHALL be route-level evidence for this slice

This slice SHALL treat real route-level screenshots as the primary acceptance artifact for the visual-law work, including temporary-view states and resource activation states. The evidence SHALL NOT pass if known review-shell defects remain visible in screenshots or route-level DOM proof.

#### Scenario: Visual acceptance uses real example screenshots

- **WHEN** the operator claims the visual law is aligned
- **THEN** fresh route-level screenshots from the real example URL exist
- **AND** those screenshots cover the base room shell, message actions, resource preview/detail, and token-triggered activation states
- **AND** source-comment edit state is covered by route-level proof so bottom sheets cannot hide the textarea or clip save actions
- **AND** return-to-latest proof covers real route geometry so a top-aligned sparse transcript cannot invert the bottom-anchored scroll coordinate system
- **AND** wide-viewport message action screenshots prove the visible popover remains geometrically attached to the trigger/bubble layer
- **AND** visible screenshots and route-level DOM proof do not expose Framework7 implementation glyph names as page text
- **AND** iPhone 14 child-page screenshots show complete child pages without half-open or offset root-page leakage
- **AND** resource preview screenshot proof opens from stable accessible token/tile entrypoints
- **AND** those screenshots are reviewed against official Framework7/iOS component topology and default visual language
- **AND** blueprints or change references are treated only as information-architecture references rather than binding style truth
- **AND** DOM tests are treated as behavior regression evidence rather than visual proof

#### Scenario: Screenshot evidence lands under the canonical review tree

- **WHEN** the operator captures route-level review evidence for the example app
- **THEN** the artifacts land under the expected worktree-local `.screenshot/...` tree
- **AND** the evidence set covers the base room shell, pending resource rail, `?` / `？` help completion, message actions, and resource preview/detail states
- **AND** the screenshot flow does not silently create a second nested package-local screenshot subtree
