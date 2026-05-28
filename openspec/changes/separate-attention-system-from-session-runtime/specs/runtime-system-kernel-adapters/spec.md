## MODIFIED Requirements

### Requirement: Runtime host SHALL mount adapters as the only live ingress bridge
The runtime host SHALL own adapter lifecycle and SHALL treat mounted adapters as the only supported live ingress bridge into the kernel. Runtime-private adapter mounting SHALL not be confused with durable ingress ownership: external systems MAY write attention through the independent attention control plane while no runtime is live, and adapters SHALL consume or project that truth once runtime starts.

#### Scenario: Session boot mounts kernel and adapters without source-specific kernel imports
- **WHEN** a session runtime starts
- **THEN** it creates the standalone kernel and mounts the configured system adapters
- **AND** source-specific ingress reaches the kernel only through those mounted adapters

#### Scenario: A future system can join without changing kernel imports
- **WHEN** a new runtime system is added later
- **THEN** it can integrate by adding one new adapter implementation
- **AND** the kernel package does not need new source-specific imports or source-name switch branches

#### Scenario: Offline-written ingress is recovered instead of replayed through private adapter glue
- **WHEN** durable attention commits already exist before adapters mount
- **THEN** mounted adapters consume the recovered attention truth through stable host interfaces
- **AND** runtime does not require source-specific private replay glue to reconstruct that state
