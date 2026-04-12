## MODIFIED Requirements

### Requirement: Plugin/runtime source contracts SHALL distinguish lookup hints from attention payload facts
LoopBus plugin contracts SHALL use typed source coordinates and first-class read-result fields for adapter lookup. They SHALL NOT expose a generic source-ref or read-result metadata bag.

#### Scenario: Built-in source refs stay typed
- **WHEN** a built-in system invalidates a message, terminal, or task source
- **THEN** the invalidated ref carries only typed coordinates required to re-read truth
- **AND** it does not carry a generic `meta` object

#### Scenario: Source reads expose only first-class scheduler fields
- **WHEN** a source adapter reads a deferred source ref
- **THEN** the read result exposes only explicit fields such as `kind`, `fromHash`, `toHash`, `semanticHash`, or `viewHash`
- **AND** AI-visible detail must still be promoted into attention drafts instead of a read-result metadata bag
