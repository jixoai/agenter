## Proposal

Refactor the runtime skill system into orthogonal platform atoms without changing the public skill identity model or current runtime behavior.

The current `RuntimeSkillSystem` correctly owns runtime-visible skill truth, watcher hints, fingerprint manifest baselines, diffing, and attention ingress publication, but those rules are concentrated in one large class. This change keeps `skill.name` as the only identity key for override semantics while separating catalog/truth, diff, baseline storage, watcher dirtiness, and attention publishing into small modules behind the existing facade.

## Goals

- Preserve current runtime skill behavior, including same-name override by `skill.name`.
- Keep fingerprint manifest generation based on stable observed-file lists and per-file hashes.
- Make `RuntimeSkillSystem` a coordinator instead of the owner of every rule.
- Add focused BDD coverage for the new atom boundaries.

## Non-Goals

- Do not introduce source-qualified skill identity.
- Do not change CLI/API response shapes.
- Do not expand watched truth beyond `SKILL.md`, existing `ccski.config.json`, and config-declared files.
