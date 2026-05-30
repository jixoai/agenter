---
name: create-agenter-app
description: Create or update Agenter app packages, including first-party repo apps under apps/* and community agenter-app-* packages with peerDependencies.agenter compatibility.
---

# Create Agenter App

Use this skill when creating or validating an Agenter app package. Agenter is the host platform; app packages own their compatibility, launch metadata, and implementation.

## Core Law

- App packages live as apps, not extensions.
- First-party apps live under `apps/*` when working in the Agenter repository.
- Community app package names should use `agenter-app-*` unless the owner has a scoped package convention.
- Compatibility belongs in the app package: `peerDependencies.agenter`.
- Discovery metadata such as `keywords: ["agenter-app"]` or catalog entries can identify candidates, but it is not compatibility proof.
- Launch metadata is data: app id, command, package name, bin, optional main export, source policy, and capability hints.
- Do not add host-owned version lock tables when creating a community app.

## Workflow

1. Decide whether this is repo mode or external mode.
2. Scaffold with the bundled Bun script when creating a package.
3. Validate the package metadata before editing app-specific behavior.
4. Keep app implementation outside Agenter core packages; consume platform capabilities through descriptors, daemon/client-sdk, app runtime APIs, resource binding, and attention contracts.

## Scripts

Run scripts with Bun:

```bash
bun run skills/create-agenter-app/scripts/scaffold.ts --repo --repo-root . --app-id notes --command notes --package-name agenter-app-notes --agenter-range ">=1.0.0 <1.1.0"
bun run skills/create-agenter-app/scripts/scaffold.ts --target ./weather-app --app-id weather --command weather --package-name agenter-app-weather --agenter-range ">=1.0.0 <1.1.0"
bun run skills/create-agenter-app/scripts/validate.ts --target ./weather-app
```

Repo mode defaults the target to `<repo-root>/apps/<app-id>`. External mode uses `--target`; if no target is supplied, it validates or scaffolds the current working directory.

Handwritten scaffolding is a fallback only when scripts cannot run.
