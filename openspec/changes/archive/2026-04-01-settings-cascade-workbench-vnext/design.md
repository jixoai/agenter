## Context

Settings resolution currently outputs only merged JSON and source file metadata. The UI therefore cannot explain field lineage or derived transforms, and workspace/global settings use different interaction contracts. This change spans `@agenter/settings`, app-server APIs, client runtime store, and both settings surfaces in WebUI.

## Goals / Non-Goals

**Goals:**
- Introduce a cascade graph model that preserves per-field provenance chains across file layers and derived transforms.
- Export JSON Schema from zod so settings view rendering can be schema-driven instead of hardcoded quick fields.
- Unify workspace and global settings surfaces under the same source/view workbench interaction model.
- Support effective-to-layer jump by mapping effective field pointer to target layer pointer.

**Non-Goals:**
- Full JSON Schema keyword coverage (e.g., full oneOf/allOf editing semantics) in v1.
- Replacing avatar catalog management UX in global settings.
- Changing settings precedence semantics (user/project/local order remains unchanged).

## Decisions

1. **Cascade graph as first-class output from `loadSettings`**
   - Add graph metadata alongside existing `settings`/`meta` for compatibility.
   - Graph contains layers, field provenance chains keyed by JSON Pointer, and effective projection.
   - Rationale: preserves existing API callers while enabling richer consumers.

2. **Derived transforms are explicit provenance nodes**
   - Path normalization, provider normalization, and active-provider selection append derived nodes to field chains.
   - Rationale: users can distinguish "from file" vs "system rewrite" and debug unexpected effective values.

3. **Scope-based app-server settings graph API**
   - Add scope endpoints for `workspace|global` that share one output contract.
   - Keep existing legacy endpoints for compatibility during migration.
   - Rationale: single contract for both surfaces, lower long-term maintenance cost.

4. **Schema-driven source/view workbench in WebUI**
   - Effective and layer details both expose `Source` and `View` tabs.
   - `View` renders core schema types (`object/array/scalar/enum/record`) with fallback blocks for unsupported composites.
   - Rationale: avoid hardcoded field UI and scale with settings schema evolution.

5. **Jump target computed from provenance**
   - Effective field click resolves a jump target to layer/view pointer (prefer editable file layer; fallback to first file layer).
   - Rationale: deterministic navigation from read-only effective projection to editable source context.

## Risks / Trade-offs

- **[Risk] Provenance payload growth for large settings** → Mitigation: limit provenance to touched pointers and avoid storing full snapshots per layer.
- **[Risk] Schema-driven editor complexity** → Mitigation: core type coverage + explicit fallback node, keep source tab as universal escape hatch.
- **[Risk] Contract migration churn across app-server/client/webui** → Mitigation: keep existing endpoints during migration and upgrade consumers incrementally.
- **[Risk] Divergence between schema and renderer behavior** → Mitigation: add Storybook DOM scenarios for both workspace and global workbenches.
