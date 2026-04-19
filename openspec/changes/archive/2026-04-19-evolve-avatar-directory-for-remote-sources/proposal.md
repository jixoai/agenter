## Why

The current `Avatars` workbench assumes every visible avatar is already a local catalog entry. That local-only mental model is too narrow for the next step: users will need to discover avatar packages from multiple remote sources, install them into the local catalog, and still operate them as normal local avatars without splitting the platform into `local` vs `remote` ontologies.

This needs to be formalized now because the wrong move is easy: adding `isRemote` branches directly into avatar runtime, workbench, and install flows. The correct platform law is to keep Avatar as one local operational identity, while modeling remote capability through source/package/install provenance.

## What Changes

- Introduce a unified Avatar Directory model that separates local avatar identity from remote source/package provenance.
- Add a new `Discover` surface for browsing installable avatar packages from subscribed sources.
- Add a new `Sources` surface for managing multiple subscribed avatar sources and their aliases.
- Keep `My Avatars` as the default `Avatars` landing surface and preserve runtime-first operation there.
- Define install as the default durable acquisition flow: remote packages install into the local avatar catalog, default to the remote name, and require rename only on local conflict.
- Require installed avatars to retain provenance facts such as source, package, and revision while remaining operationally equivalent to purely local avatars.
- Keep transient direct-launch of remote packages out of the default product path; it may exist later as an optional capability, but it is not the primary durable workflow for this change.
- Record the user interview and Q&A verbatim inside this change so future implementation work does not lose the original product intent.

## Capabilities

### New Capabilities
- `avatar-source-directory`: Define subscribed avatar sources, discovery surfaces, install flows, and installed-avatar provenance.

### Modified Capabilities
- `workspace-avatar-management`: Evolve the `Avatars` workbench from a fixed local catalog surface into a unified directory with `My Avatars / Discover / Sources`, while keeping installed avatars runtime-first and local-operational.

## Impact

- WebUI avatar information architecture, routing, and workbench tab composition
- Client/runtime store contracts for avatar sources, discover results, install operations, and provenance projection
- Backend avatar/source installation contracts and durable avatar metadata storage
- Avatar-related durable specs and OpenSpec product/design records
