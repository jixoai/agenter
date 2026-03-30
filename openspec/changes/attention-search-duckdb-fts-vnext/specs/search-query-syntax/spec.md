## Purpose

Define the shared Lucene-like query syntax used by Agenter search surfaces and backend adapters.

## Requirements

### Requirement: Search syntax SHALL parse a shared Lucene-like core

The shared search syntax SHALL support fielded clauses, quoted phrases, boolean operators, parentheses, and comparison operators in one stable AST contract.

#### Scenario: Fielded and quoted clauses parse into one AST

- **WHEN** a caller parses `author:avatar:jane AND "weather report"`
- **THEN** the parser returns a stable AST that preserves the fielded author clause and the quoted phrase clause
- **THEN** the parser does not silently flatten the query into raw text tokens

#### Scenario: Boolean grouping is explicit

- **WHEN** a caller parses `(source:terminal OR source:message) AND NOT "draft"`
- **THEN** the AST preserves the grouping and boolean operators explicitly
- **THEN** downstream adapters can distinguish grouped logic from plain conjunction

#### Scenario: Comparison clauses are first-class syntax

- **WHEN** a caller parses `createdAt:>2026-03-01`
- **THEN** the parser returns a comparison node instead of degrading the clause into a plain text token

### Requirement: Search syntax SHALL surface diagnostics for invalid input

Invalid queries SHALL return diagnostics that explain the parse failure instead of silently dropping malformed segments.

#### Scenario: Unterminated phrase is rejected

- **WHEN** a caller parses `"unfinished`
- **THEN** the parser reports an unterminated phrase diagnostic
- **THEN** it does not pretend the query is valid

#### Scenario: Missing grouped operand is rejected

- **WHEN** a caller parses `author:jane AND )`
- **THEN** the parser reports a structural diagnostic for the unexpected token
- **THEN** the caller can render that error without guessing
