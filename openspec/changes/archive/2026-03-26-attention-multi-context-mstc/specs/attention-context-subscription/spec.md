Define how external systems subscribe to attention-context changes for event-driven integration.

## ADDED Requirements

### Requirement: AttentionSystem SHALL support filtered context subscriptions
External systems SHALL be able to subscribe to a specific context with a filter function, receiving only items that match the filter criteria.

#### Scenario: Filtered subscription triggers on matching item
- **GIVEN** a subscription on context "ctx-1" with filter `(item) => item.meta.from === "jane"`
- **WHEN** an item with `meta.from: "jane"` is added to "ctx-1"
- **THEN** the subscription listener is called with that item

#### Scenario: Filtered subscription does not trigger on non-matching item
- **GIVEN** a subscription on context "ctx-1" with filter `(item) => item.meta.from === "jane"`
- **WHEN** an item with `meta.from: "kzf"` is added to "ctx-1"
- **THEN** the subscription listener is NOT called

#### Scenario: Subscription to non-existent context fails
- **WHEN** `subscribe("nonexistent", filter, listener)` is called
- **THEN** an error is thrown indicating the context does not exist

### Requirement: Global change listeners SHALL receive all context changes
`onChange()` on AttentionSystem SHALL fire for every item change across all contexts, annotated with the context ID.

#### Scenario: Global listener receives items from all contexts
- **GIVEN** a global listener registered via `onChange(listener)`
- **WHEN** an item is added to context "ctx-1" and another to context "ctx-2"
- **THEN** the listener is called twice, once with contextId "ctx-1" and once with "ctx-2"

### Requirement: Subscriptions SHALL be cancellable
The subscribe call SHALL return an unsubscribe function. After unsubscribing, the listener SHALL no longer receive events.

#### Scenario: Unsubscribed listener receives no further events
- **GIVEN** a subscription that returns an `unsubscribe` function
- **WHEN** `unsubscribe()` is called, then a new matching item is added
- **THEN** the listener is NOT called for the new item
