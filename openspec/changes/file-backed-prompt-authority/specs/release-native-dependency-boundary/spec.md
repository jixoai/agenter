## ADDED Requirements

### Requirement: Native watcher dependency SHALL remain external to bundled runtime output

Any bundled Agenter runtime entry that imports `@jixo/reactive-fs` SHALL keep `@parcel/watcher` external during bundling. The release bundle manifest SHALL declare install-time/runtime dependencies needed for `@parcel/watcher` resolution instead of attempting to inline native watcher bindings into generated JavaScript output.

This requirement applies to Bun bundle output, tsdown-style output, and any future release builder that bundles runtime entries. Native dependency externalization SHALL be covered by release/package boundary tests.

#### Scenario: CLI bundle keeps watcher native binding external

- **GIVEN** the publishable Agenter CLI bundle imports code that depends on `@jixo/reactive-fs`
- **WHEN** the release bundle spec is inspected
- **THEN** `@parcel/watcher` is listed as an external runtime dependency
- **AND** the generated bundle does not inline watcher native binding code

#### Scenario: Release test fails if watcher externalization is removed

- **GIVEN** a contributor removes `@parcel/watcher` from release externalization
- **WHEN** release boundary tests run
- **THEN** the tests fail before publish
- **AND** the failure identifies the native watcher dependency boundary

### Requirement: Reactive filesystem package SHALL publish with native dependency metadata

`@jixo/reactive-fs` SHALL declare `@parcel/watcher` in package metadata as a runtime dependency or equivalent install-time dependency. The package SHALL keep its exported JavaScript domain-neutral and SHALL not require Agenter release assets to make watcher resolution work.

If a consumer runs in a static or watcher-disabled environment, the package MAY expose a no-op watcher mode, but it SHALL still make watcher initialization and runtime status inspectable so consumers can distinguish "not initialized" from "watching successfully".

#### Scenario: OpenSpecUI can reuse the package

- **GIVEN** OpenSpecUI installs `@jixo/reactive-fs`
- **WHEN** it initializes watcher-backed reactive reads
- **THEN** `@parcel/watcher` resolves from package installation
- **AND** OpenSpecUI does not need Agenter-specific bundle assets or prompt authority code

#### Scenario: Watcher-disabled mode is explicit

- **GIVEN** a consumer uses reactive reads before watcher initialization or in a static export mode
- **WHEN** it inspects watcher runtime status
- **THEN** the status shows that watchers are not initialized or disabled
- **AND** consumers do not misinterpret the absence of watcher callbacks as current file freshness

