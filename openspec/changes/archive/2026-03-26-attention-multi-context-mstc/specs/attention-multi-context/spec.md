Define the multi-context attention management contract, where each context is an isolated attention notebook owned by an avatar.

## ADDED Requirements

### Requirement: AttentionSystem SHALL manage multiple named contexts
Each context SHALL have a unique ID and an owner (avatar name). The system SHALL support creating, retrieving, listing, and removing contexts.

#### Scenario: Creating a context with explicit ID
- **WHEN** `createContext({ id: "ctx-chat-1", owner: "jane" })` is called
- **THEN** a new context is created with ID "ctx-chat-1" and owner "jane"
- **THEN** the context appears in `listContexts()`

#### Scenario: Creating a context with duplicate ID fails
- **GIVEN** a context with ID "ctx-1" already exists
- **WHEN** `createContext({ id: "ctx-1", owner: "bob" })` is called
- **THEN** an error is thrown indicating the context already exists

#### Scenario: Removing a context
- **GIVEN** a context with ID "ctx-1" exists
- **WHEN** `removeContext("ctx-1")` is called
- **THEN** `getContext("ctx-1")` returns undefined
- **THEN** the context no longer appears in `listContexts()`

### Requirement: Cross-context queries SHALL aggregate results from all contexts
`getAllActive()` and `queryByHash()` SHALL return items from every context, each annotated with its context ID.

#### Scenario: getAllActive returns items from all contexts
- **GIVEN** context "ctx-1" has an active item and context "ctx-2" has an active item
- **WHEN** `getAllActive()` is called
- **THEN** both items are returned, each with their respective contextId

#### Scenario: queryByHash searches across contexts
- **GIVEN** context "ctx-1" has an item with `scores: { hash1: 100 }` and context "ctx-2" has an item with `scores: { hash1: 50 }`
- **WHEN** `queryByHash("hash1")` is called
- **THEN** both items are returned with their respective contextId values

### Requirement: AttentionSystem SHALL support snapshot and restore
The system SHALL serialize all contexts and their items to a snapshot, and restore from a snapshot preserving all state.

#### Scenario: Snapshot round-trip preserves all contexts and items
- **GIVEN** a system with two contexts, each containing items
- **WHEN** `snapshot()` is called, then `AttentionSystem.fromSnapshot(snapshot)` is used to restore
- **THEN** the restored system has the same contexts with the same owners and items

#### Scenario: Adding items to a restored system works correctly
- **GIVEN** a system restored from a snapshot
- **WHEN** a new item is added to an existing context
- **THEN** the item is stored successfully with a new unique ID
