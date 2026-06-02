## ADDED Requirements

### Requirement: Prompt rendering SHALL return text plus dependency evidence

Prompt rendering SHALL return a structured result that includes the rendered prompt text, source identity, dependency nodes, render timestamp, render hash or equivalent freshness identity, and Avatar prompt ownership policy. Dependency nodes SHALL include the original resource URI, resolved file path when available, owner kind, read kind, and freshness fields such as mtime, content hash, or stat identity.

Rendered prompt text is a projection. Source files and dependency nodes are the traceable truth. The runtime MUST NOT treat rendered prompt text, imported package defaults, or session summaries as a replacement for file-backed prompt authority.

#### Scenario: Prompt inspection shows complete source trace

- **GIVEN** a prompt render uses an Avatar wrapper, builtin prompt files, and an app package prompt file
- **WHEN** an operator inspects the prompt source report
- **THEN** the report includes every dependency node used by the render
- **AND** it distinguishes Avatar-owned files, daemon-managed builtin files, and package-owned app resources

#### Scenario: Rendered prompt projection does not become authority

- **GIVEN** a model call stores the rendered system prompt text or a prompt hash for audit
- **WHEN** a later prompt render is requested
- **THEN** the runtime rereads the file-backed prompt sources
- **AND** it does not use the old rendered text as the source of truth

### Requirement: Prompt dependency changes SHALL refresh only at safe model boundaries

Prompt dependency changes SHALL mark affected runtime prompt state dirty. The runtime SHALL refresh prompt rendering at the next safe model input collection or model-call boundary. It MUST NOT mutate an in-flight provider request body, silently rewrite a running model call's system prompt, or trigger uncontrolled model recursion solely because a file changed.

Dirty prompt state SHALL be observable before refresh. After refresh, the runtime SHALL record the prompt render identity used by the next model call so operators can distinguish current and stale prompt usage.

#### Scenario: File change marks prompt dirty

- **GIVEN** a running session last rendered its prompt from a dependency graph
- **WHEN** one dependency file changes
- **THEN** the session prompt state is marked dirty with the changed dependency as effect source
- **AND** the current in-flight provider request, if any, is not mutated

#### Scenario: Next model boundary rereads prompt files

- **GIVEN** a session has dirty prompt state
- **WHEN** the runtime reaches the next safe model input collection boundary
- **THEN** it rerenders the prompt from the current files
- **AND** the next provider request uses the new render identity
- **AND** the model-call ledger can show which prompt render was used

### Requirement: Prompt resource resolution SHALL preserve explicit file dependency identity

Prompt resource resolution SHALL resolve `global:`, `app:`, `npm:`, `file:`, `http:`, and `https:` resources without hiding the underlying authority. File-backed resources SHALL produce concrete dependency nodes. Package resources SHALL resolve through package or app metadata to an inspectable package file or bundled asset path. Network resources, when supported, SHALL be represented as non-file dependencies with explicit freshness limits rather than pretending to be watched local files.

Slot variables such as `$LANG` and `${LANG}` SHALL be expanded before dependency identity is finalized. Nested Slots SHALL preserve parent slot variables and dependency traces.

#### Scenario: Slot resource resolves to concrete dependency

- **GIVEN** an Avatar `AGENTER.mdx` contains `<Slot src="global:builtin/$LANG/AGENTER.mdx" />`
- **WHEN** `$LANG` is `zh-Hans`
- **THEN** the dependency graph records the expanded URI
- **AND** it records the resolved `~/.agenter/builtin/zh-Hans/AGENTER.mdx` file path

#### Scenario: Package prompt resource is inspectable

- **GIVEN** an Avatar wrapper includes an app prompt resource such as `app:shell/ShellAssistant.mdx`
- **WHEN** the renderer resolves that Slot
- **THEN** the dependency graph records the app resource URI
- **AND** it records the package or bundled asset path used for the read
- **AND** operators are not required to trust hidden package import memory

