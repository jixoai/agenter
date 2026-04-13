## ADDED Requirements

### Requirement: OverlayRuleFs SHALL enforce ordered glob rules over one real filesystem root
The filesystem SHALL implement `just-bash`'s `IFileSystem` contract over one real root directory while enforcing ordered glob rules with `default deny`, `last match wins`, and partial traversal semantics for directory visibility.

#### Scenario: Later rule overrides an earlier broader rule
- **GIVEN** the rule set marks `/src/**` as `ro` and later marks `/src/generated/**` as `rw`
- **WHEN** a caller writes `/src/generated/out.txt`
- **THEN** the write succeeds because the later narrower rule wins
- **AND** a write to `/src/manual/out.txt` still fails under the earlier `ro` rule

#### Scenario: Directory listing only reveals traversable children
- **GIVEN** the rule set grants `/src/**` but denies `/docs/**`
- **WHEN** a caller lists the real root directory through the filesystem
- **THEN** the result includes `src`
- **AND** the result omits `docs`

### Requirement: OverlayRuleFs SHALL support dynamic rule reconfiguration without replacing the filesystem instance
The filesystem SHALL allow its effective rule configuration to change while the same `IFileSystem` instance remains mounted.

#### Scenario: A later shell read sees an updated rule set
- **GIVEN** one filesystem instance currently denies `/notes/todo.md`
- **WHEN** the host updates the rule configuration to grant `/notes/**` as readable
- **THEN** a later read of `/notes/todo.md` through that same filesystem instance succeeds
- **AND** the host does not need to replace the mounted filesystem object just to apply the new rules

### Requirement: OverlayRuleFs SHALL isolate avatar-private roots from sibling private roots
The filesystem SHALL allow the host to expose shared public roots together with the current avatar's private roots while hiding sibling avatars' private roots from reads, stats, and directory listings.

#### Scenario: One avatar cannot see another avatar's private drawer
- **GIVEN** the real workspace contains `/.agenter/avatars/by-principal/alice/private.txt` and `/.agenter/avatars/by-principal/bob/private.txt`
- **AND** the filesystem is configured for avatar `alice`
- **WHEN** the caller reads or lists under Bob's private subtree
- **THEN** the access is denied or hidden
- **AND** Alice's own private subtree remains available

### Requirement: OverlayRuleFs SHALL support configurable exposed mount paths over the same real authority
The filesystem SHALL allow the host to expose the same real root through different visible path styles, including real absolute mounts and synthetic single-root mounts, without changing the underlying rule semantics.

#### Scenario: Root shell and workspace shell reuse the same rule engine with different visible roots
- **GIVEN** one host mounts the real workspace at its absolute path and another mounts the same workspace at `/workspace`
- **WHEN** both hosts evaluate the same grant rules through OverlayRuleFs
- **THEN** both surfaces enforce the same readable and writable boundaries
- **AND** only the visible mount path presentation differs
