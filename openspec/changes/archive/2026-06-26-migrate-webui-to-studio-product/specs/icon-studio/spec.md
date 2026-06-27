## ADDED Requirements

### Requirement: Icon Studio SHALL be the dedicated icon composer package

The existing icon composer package SHALL be named `@agenter/icon-studio` and live at `packages/icon-studio`. It SHALL remain a dedicated tooling app for icon composition and asset generation, separate from the operator `agenter-app-studio` app.

#### Scenario: Icon Studio package identity is unambiguous

- **WHEN** workspace package discovery resolves the icon composer package
- **THEN** it resolves package `@agenter/icon-studio`
- **AND** it resolves from `packages/icon-studio`
- **AND** it does not use the package name `@agenter/ui-studio`

#### Scenario: Icon scripts consume Icon Studio exports

- **WHEN** repository asset scripts generate icon masters or Lucide metadata
- **THEN** they import from `@agenter/icon-studio` or its package-owned generated paths
- **AND** they do not import through the operator `agenter-app-studio` package

### Requirement: Icon Studio SHALL stay orthogonal to operator Studio

Icon Studio SHALL own icon composer routes, slot catalogs, symbol browsing, and icon rendering helpers. Operator Studio MAY consume generated app assets, but it SHALL NOT become the source of truth for icon composer internals.

#### Scenario: Operator Studio does not own icon composer routes

- **WHEN** `agenter-app-studio` starts as the operator app
- **THEN** it does not mount Icon Studio's icon composer route tree by default
- **AND** icon composer development remains owned by `@agenter/icon-studio`
