## ADDED Requirements

### Requirement: Attention commits SHALL separate item detail from context mutation

The attention system SHALL preserve each commit's immutable `change` payload as item/detail history independently from whether that payload mutates the current context summary. A commit without an explicit context-mutation intent SHALL keep the existing apply behavior for compatibility.

#### Scenario: Context-preserving commit keeps item detail
- **GIVEN** an attention context already contains an Avatar-authored summary
- **WHEN** a commit lands with context mutation set to preserve and a non-clean detail payload
- **THEN** the commit history preserves that detail payload
- **AND** current context content, slots, and content format remain unchanged
- **AND** the context score map and head commit advance using the committed scores

#### Scenario: Default commit still updates context
- **WHEN** a commit lands without an explicit context-mutation intent
- **THEN** the attention system applies the commit change to the current context as before
