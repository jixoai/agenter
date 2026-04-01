## Why

The current settings pipeline only returns final merged JSON plus a source list, so users cannot inspect field-level origins, derived transforms, or jump from effective values back to source layers. Workspace and global settings also use divergent interaction models, which blocks consistent evolution as avatar and nested layer stacks grow.

## What Changes

- Introduce a cascade graph output for settings resolution: effective values, layer lineage, field-level provenance chains, and schema metadata.
- Add explicit derived provenance nodes for post-merge transforms (path normalization, provider normalization, active provider selection).
- Upgrade workspace/global settings APIs to one scope-based contract with shared response structure.
- Rebuild settings UI as a unified workbench with `Source` and schema-driven `View` modes for effective and layer surfaces.
- Enable effective-to-layer field jump: clicking an effective field focuses the mapped layer field in layer `View`.

## Capabilities

### New Capabilities
- `settings-cascade-provenance`: Field-level cascade lineage model with explicit file and derived nodes, plus schema-aware metadata for view rendering.

### Modified Capabilities
- `workspace-settings`: Upgrade from read-only effective JSON + raw layer editor to source/view dual-mode workbench with provenance-aware jump.
- `global-user-settings`: Reuse the same settings workbench architecture for user settings while preserving avatar catalog management.

## Impact

- Affected packages: `@agenter/settings`, `@agenter/app-server`, `@agenter/client-sdk`, `@agenter/webui`.
- New API surface for scope-based settings graph read/save and richer effective payload.
- Storybook DOM contracts and app-server/unit tests must migrate to the new response structure and interaction model.
