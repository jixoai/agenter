## MODIFIED Requirements

### Requirement: Svelte WebUI SHALL place primary and secondary content through responsive shells
The active Svelte WebUI SHALL model primary content, navigation, secondary context, and parallel tools through explicit responsive shells. Shared structural shells such as `ScrollView`, `Scaffold`, `DialogScaffold`, and `SplitView` SHALL be consumed from `@agenter/svelte-components` rather than being implemented inside `@agenter/webui`.

#### Scenario: WebUI route consumes shared structural package
- **WHEN** a WebUI route or shell needs scrolling or scaffold-family layout
- **THEN** it composes the shared primitives from `@agenter/svelte-components`
- **THEN** `@agenter/webui` stays a product assembly layer instead of becoming the source of truth for shared layout law
