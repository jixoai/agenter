## Purpose

Define the durable Storybook static-build contract for the active Svelte Studio package.

## Requirements

### Requirement: WebUI Storybook toolchain SHALL keep DOM and static builds aligned

The `agenter-app-studio` package SHALL keep its official Storybook DOM workflow and static Storybook build on one compatible dependency line. The repository MUST NOT accept a state where Storybook DOM tests pass while `pnpm --filter 'agenter-app-studio' storybook:build` crashes under the same lockfile.

#### Scenario: Static Storybook build succeeds for the active WebUI package

- **WHEN** the operator runs `pnpm --filter 'agenter-app-studio' storybook:build`
- **THEN** Storybook exits successfully without a runtime crash
- **THEN** the generated static artifact includes the current workbench, workspace, and runtime stories

### Requirement: Storybook upgrades SHALL preserve required addon patches

If the workspace carries a required patch for Storybook integration packages, the Studio Storybook dependency line SHALL stay compatible with that patch until a separate verified change removes or replaces it.

#### Scenario: Storybook dependency refresh keeps the Svelte CSF patch applied

- **WHEN** the Studio Storybook packages are upgraded within the workspace
- **THEN** dependency installation still applies the repository patch for `@storybook/addon-svelte-csf`
- **THEN** the upgraded Storybook toolchain remains usable for both static build and Storybook DOM regression execution
