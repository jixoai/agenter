# terminal-input-modes Specification

## Purpose

Define the durable raw vs mixed input law for terminal-core, pending inbox files, and automation-facing terminal surfaces.

## Requirements

### Requirement: Automation-facing terminal input SHALL be mode-aware and pending-backed

Automation-facing terminal input SHALL use the pending inbox as its authoritative path, with explicit `raw` and `mixed` modes. Pending files SHALL use explicit mode suffixes instead of legacy `.xml` or generic `.txt`.

#### Scenario: Raw pending files are written verbatim

- **WHEN** terminal-core consumes a file ending in `.raw.txt`
- **THEN** the file content is written to the PTY verbatim
- **AND** terminal-core does not interpret mixed tags inside that content

#### Scenario: Mixed pending files are parsed through the mixed DSL

- **WHEN** terminal-core consumes a file ending in `.mixed.txt`
- **THEN** the file content is parsed as mixed input
- **AND** recognized `<key .../>` and `<wait .../>` actions are executed sequentially

#### Scenario: Legacy pending suffixes are rejected

- **WHEN** a caller writes automation input into a pending file ending in `.xml` or bare `.txt`
- **THEN** terminal-core does not treat that file as a valid automation input unit
- **AND** only `.raw.txt` and `.mixed.txt` are authoritative pending suffixes

### Requirement: Mixed input SHALL support raw literal blocks

Mixed input SHALL support `<raw>...</raw>` blocks so callers can emit tag-like text without invoking mixed control actions.

#### Scenario: Raw block preserves literal tag-like text

- **WHEN** mixed input contains `<raw><key data="enter"/></raw>`
- **THEN** terminal-core writes the literal text `<key data="enter"/>`
- **AND** it does not synthesize an Enter key event from that raw block

#### Scenario: Raw block decodes fixed HTML entities

- **WHEN** mixed input contains `<raw>&lt;/raw&gt; &amp; &quot;x&quot; &#39;y&#39;</raw>`
- **THEN** terminal-core writes `</raw> & "x" 'y'`
- **AND** decoding is limited to the fixed supported HTML entities defined by terminal-core

#### Scenario: Unterminated raw block fails the pending unit

- **WHEN** a mixed pending file opens `<raw>` without a matching closing `</raw>`
- **THEN** terminal-core rejects that pending input unit
- **AND** the file is moved into `input/failed`

#### Scenario: Nested raw blocks are rejected instead of being partially consumed

- **WHEN** a mixed pending file places another `<raw>` inside an open `<raw>...</raw>` block
- **THEN** terminal-core rejects that pending input unit
- **AND** it does not partially consume the outer raw block or leak a stray `</raw>` into terminal output

### Requirement: Interactive raw forwarding SHALL remain a separate live path

terminal-core MAY retain a direct raw forwarding API for live human interaction, but that path SHALL remain distinct from automation pending truth.

#### Scenario: Interactive forwarding bypass is not the automation source of truth

- **WHEN** ATI-CLI or ATI-TUI forwards keystrokes through the live raw API
- **THEN** the input reaches the PTY immediately for interactive responsiveness
- **AND** automation-facing runtime or control-plane paths still use pending-backed raw or mixed input instead of that direct bypass

### Requirement: Queue waiting SHALL stay distinct from mixed wait actions

The pending enqueue API's completion wait semantics SHALL remain distinct from the mixed DSL's `<wait ms="..."/>` action semantics.

#### Scenario: Pending wait only controls caller completion behavior

- **WHEN** a caller enqueues pending input with `wait: false`
- **THEN** terminal-core returns without waiting for `.done` or `.failed`
- **AND** this does not remove or alter any `<wait ms="..."/>` actions inside mixed content

#### Scenario: Mixed wait only pauses the input action sequence

- **WHEN** mixed input contains `<wait ms="300"/>`
- **THEN** terminal-core pauses the sequential PTY action stream for that duration
- **AND** this does not change whether the enqueue caller waits for pending completion
