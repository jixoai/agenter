## MODIFIED Requirements

### Requirement: Shared Svelte structural primitives SHALL live in @agenter/svelte-components

The repository SHALL expose `@agenter/svelte-components` as the shared Svelte structural package for durable scroll ownership and scaffold-family layout law. Shared Svelte consumers SHALL import structural primitives from that package instead of reaching into product-local `webui` source. That package SHALL expose `ScrollView` for standard surfaces and the anchored virtual list scroll platform for WebChat-like virtual long lists. The anchored virtual list platform exported from this package SHALL own the full transaction runtime, ownership chain, and terminal viewport writer rather than leaving render-layer or consumer-layer code to complete scroll choreography privately.

#### Scenario: Shared Svelte consumer resolves one structural package

- **WHEN** a shared Svelte package such as `web-chat-view` needs transcript scrolling or shell layout primitives
- **THEN** it imports them from `@agenter/svelte-components`
- **THEN** it does not depend on `@agenter/webui` to recover those primitives

#### Scenario: Shared structural package exports standard and anchored scroll law together

- **WHEN** engineers consume `@agenter/svelte-components`
- **THEN** the package exports `ScrollView` for standard surfaces
- **AND** it exports the anchored virtual list scroll platform for WebChat-like long lists
- **AND** consumers do not need a second product-local package just to recover anchored transcript scrolling

#### Scenario: Shared anchored runtime owns the full viewport choreography

- **WHEN** append, prepend, insert motion, or target materialization occurs inside an anchored virtual list
- **THEN** the shared package runtime owns the final viewport choreography
- **AND** consumer packages do not need package-local preserve or reveal controllers to complete the flow
