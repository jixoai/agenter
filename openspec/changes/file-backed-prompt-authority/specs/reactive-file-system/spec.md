## ADDED Requirements

### Requirement: Reactive filesystem SHALL be a reusable Jixo package atom

The reactive filesystem SHALL be extracted as `@jixo/reactive-fs`. It SHALL be a domain-neutral package that contains file reactivity primitives only, so Agenter and OpenSpecUI can both depend on it without importing prompt, Avatar, OpenSpec, daemon, or UI concepts.

The package API SHALL expose typed primitives for reactive contexts, reactive state, reactive file reads, reactive directory reads, reactive existence checks, reactive stat reads, watcher initialization, watcher status, and watcher teardown. Prompt rendering, Avatar ownership, and release packaging policy SHALL live in consuming packages, not inside `@jixo/reactive-fs`.

#### Scenario: Package boundary has no prompt-specific coupling

- **GIVEN** `@jixo/reactive-fs` is used by Agenter prompt authority
- **WHEN** another project such as OpenSpecUI imports the package
- **THEN** it can consume reactive file primitives without depending on Agenter prompt types
- **AND** the package does not expose Avatar, PromptStore, OpenSpec, daemon, or UI model types

#### Scenario: Public exports remain type-safe

- **GIVEN** a consumer imports `@jixo/reactive-fs`
- **WHEN** it uses reactive file operations and watcher status APIs
- **THEN** the exported types describe the operation kind, absolute path identity, read result, and watcher runtime state without requiring `any` or unchecked casts in consumer code

### Requirement: Reactive reads SHALL collect file dependencies through context execution

`@jixo/reactive-fs` SHALL provide a reactive execution context that collects dependencies from file reads performed during an async task. Reactive file operations SHALL return current filesystem values and register the corresponding dependency node when called inside that context.

The minimum dependency node shape SHALL distinguish the read kind (`file`, `directory`, `exists`, or `stat`), the normalized absolute path, and any read options that affect result identity. A context stream SHALL emit the initial task result and re-run the task after any tracked dependency changes.

#### Scenario: Prompt renderer collects Slot dependencies

- **GIVEN** a consumer renders a prompt inside a reactive context
- **AND** the render reads an Avatar `AGENTER.mdx`, a builtin prompt file, and an app package prompt file
- **WHEN** the render completes
- **THEN** the context has tracked every file read as a dependency
- **AND** a later change to any tracked file can re-run the render task

#### Scenario: Missing file dependencies are tracked

- **GIVEN** a consumer reads a file that does not exist yet inside a reactive context
- **WHEN** that file is created later
- **THEN** the reactive context is notified
- **AND** the next emitted result observes the newly created file instead of staying pinned to `null`

### Requirement: Watcher pool SHALL expose shared runtime status and support multiple roots

`@jixo/reactive-fs` SHALL provide watcher pooling so multiple reactive reads can share watcher subscriptions. Watcher initialization SHALL support a registry of watched roots, because prompt dependencies can span `~/.agenter`, package source files, bundled asset roots, and workspace files.

Watcher runtime status SHALL be inspectable and SHALL include at least initialization state, watched root identity, subscription count, generation, reinitialize count, last reinitialize reason, reason counters, and project/root residency. Watchers SHALL normalize paths through real existing ancestors so symlinked roots and newly created descendants remain matchable.

#### Scenario: Prompt dependencies span home and package roots

- **GIVEN** a prompt render reads `~/.agenter/avatars/by-principal/<id>/AGENTER.mdx`
- **AND** it also reads `app:shell/ShellAssistant.mdx` from an installed package or source root
- **WHEN** watcher roots are initialized
- **THEN** both the home root and package root can be watched
- **AND** the dependency graph does not assume a single project directory covers every prompt source

#### Scenario: Watcher liveness is operational evidence

- **GIVEN** a watched root disappears, is replaced, or reports dropped events
- **WHEN** the watcher detects the condition
- **THEN** the runtime status records the liveness or reinitialization reason
- **AND** consumers can expose that status as prompt freshness evidence instead of silently trusting stale watcher state

