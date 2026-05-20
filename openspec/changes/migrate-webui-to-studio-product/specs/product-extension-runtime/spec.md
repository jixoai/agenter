## ADDED Requirements

### Requirement: GUI products SHALL reuse the same product-extension law as terminal products

Graphical first-party products such as Studio SHALL consume the same descriptor, launcher env, product source, resource binding, assistant, and attention contracts as terminal products. Core runtime modules SHALL NOT add GUI-product-specific imports or branches for Studio.

#### Scenario: Studio descriptor is data, not a core branch

- **WHEN** the core launcher handles product command `studio`
- **THEN** it resolves descriptor data containing command name, package name, bin metadata, source policy, and capability hints
- **AND** the descriptor does not import `@agenter/studio` implementation code
- **AND** Studio-specific serving flags are parsed by the Studio package, not core runtime modules

#### Scenario: Core remains valid when Studio is absent

- **WHEN** the `@agenter/studio` package is absent or disabled
- **THEN** core daemon, terminal, room, AvatarRuntime, attention, auth-service, and client-sdk modules remain valid
- **AND** no core module requires Studio route state, SvelteKit build output, browser storage keys, or Storybook state to start
