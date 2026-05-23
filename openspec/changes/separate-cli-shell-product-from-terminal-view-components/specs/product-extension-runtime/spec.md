> Superseded note:
> This delta spec is built on the older `terminal-1` / `terminal-2` cli-shell ontology.
> It remains only as historical analysis and reference input. Current work must follow `realign-cli-shell-with-core-system-boundaries`.

## MODIFIED Requirements

### Requirement: Product extensions SHALL bind backend resources through generic product-owned keys

The extension runtime SHALL expose generic APIs that let a product ensure or look up backend resources through the resource owner's control plane. Product packages SHALL provide `productId` and product-local `resourceKey` values, while the owning systems remain the only authorities for terminal, room, AvatarRuntime, attention, and runtime actor truth. For runtime-owned terminal and room bindings, grant actor ids and focus truth SHALL derive from the created or reused session runtime actor identity rather than from global avatar catalog metadata.

#### Scenario: Session actor truth governs runtime-owned terminal binding
- **GIVEN** cli-shell selects an avatar through the global avatar catalog
- **AND** the created or reused session runtime actor identity differs from the catalog principal metadata
- **WHEN** cli-shell ensures the runtime-owned terminal bindings derived from product session key `shell-1`
- **THEN** terminal grant and runtime focus derive from the session runtime actor identity
- **AND** the extension runtime does not substitute the catalog principal as terminal binding truth

#### Scenario: One product session key derives two terminal binding identities without changing the generic binding contract
- **WHEN** cli-shell ensures terminal-1 shell truth and terminal-2 visible product-terminal truth for product session `shell-1`
- **THEN** it does so through two distinct product-local terminal resource keys derived from that session key
- **AND** the extension runtime does not require a cli-shell-specific terminal-role field in generic binding metadata just to distinguish those two terminal resources

#### Scenario: Session actor truth governs runtime-owned room binding
- **GIVEN** cli-shell selects an avatar through the global avatar catalog
- **AND** the created or reused session runtime actor identity differs from the catalog principal metadata
- **WHEN** cli-shell ensures the runtime-owned room binding for product resource key `shell-1`
- **THEN** room grant and runtime focus derive from the session runtime actor identity
- **AND** the extension runtime does not substitute the catalog principal as room binding truth

#### Scenario: Runtime-owned focus uses session-scoped focus planes
- **WHEN** a runtime-owned terminal or room binding requests focus
- **THEN** the extension runtime applies terminal focus through the session-owned terminal focus API
- **AND** it applies room focus through the session-owned message-channel focus API
- **AND** unrelated global-only focus state does not count as sufficient runtime focus truth

#### Scenario: Binding outputs preserve session actor truth for later attribution
- **WHEN** a product bootstrap needs actor identity later for delegation attribution, unread projection, managed-mode state, or reconnect behavior
- **THEN** the binding/bootstrap flow preserves the session runtime actor truth in its outputs
- **AND** it also preserves explicit bound resource identity such as the attached terminal id when later product projection or reconnect behavior depends on it
- **AND** later product behavior does not re-derive actor identity from catalog metadata alone
