## Context

The repository currently has two WebUI asset locations with runtime significance:

- `packages/webui/build`
- `packages/cli/assets/webui`

`agenter web` serves `packages/cli/assets/webui`, while normal SvelteKit build verification exercises `packages/webui/build`. That means the default runtime path and the current build path can drift apart. During this investigation, the fresh build already contained the room deep-link and attention search fixes, but the default CLI entry still showed older behavior until `build:assets` manually recopied the bundle.

This is not a app-level attention bug. A fresh current-code server confirmed that the real Avatar input path (`chat.send -> pushUserChat`) still generates non-empty `scoreMap` facts, and the runtime attention page renders those scores correctly. The durable bug is the delivery law itself: two competing WebUI truths make runtime verification unreliable.

## Goals / Non-Goals

**Goals:**
- Enforce one canonical WebUI asset root for each `agenter web` process.
- Make the default CLI entry reflect the current verified WebUI build instead of an older copied snapshot.
- Preserve SPA fallback behavior for nested refreshes such as `/messages/room/:chatId` and `/avatars/runtime/:sessionId/attention`.
- Fail fast when the canonical asset root is unavailable or invalid.

**Non-Goals:**
- Rework attention score production or runtime attention semantics.
- Change SvelteKit routing structure or room workbench behavior.
- Solve packaging/distribution for every future environment beyond defining the single-source law.

## Decisions

### Decision: Runtime delivery SHALL resolve one canonical asset root

`agenter web` will resolve one canonical WebUI asset root at startup and serve all SPA documents and asset files from that root only.

Why:
- This removes runtime ambiguity.
- This matches the single-source-of-truth requirement.
- It makes browser verification reflect the same build engineers just tested.

Alternatives considered:
- Keep both roots and add warnings.
  Rejected because warnings do not remove split-brain behavior.
- Keep copied assets as runtime default and require manual sync discipline.
  Rejected because this is the failure mode that already caused misleading regressions.

### Decision: Copied CLI assets become derived packaging artifacts only

If CLI packaging still needs a copied asset tree, that copy is treated as a derived deployment artifact, not a second workspace truth. In a repo workspace, the canonical root must be the actual WebUI build output or another explicitly selected canonical root.

Why:
- It preserves release flexibility without allowing silent divergence in developer/runtime workflows.

Alternatives considered:
- Delete copied assets entirely right now.
  Rejected because packaging may still require a materialized bundle, and this change should focus on truth ownership first.

### Decision: Missing or divergent roots SHALL fail fast

When the canonical root is missing, malformed, or obviously divergent from the selected runtime law, CLI startup must stop and tell the operator how to rebuild or sync assets.

Why:
- Serving stale UI is worse than failing loudly because it creates false debugging trails.

Alternatives considered:
- Best-effort fallback to another discovered root.
  Rejected because fallback selection recreates the same ambiguity under a different name.

## Risks / Trade-offs

- [Repo vs packaged runtime need different asset locations] → Resolve location through one canonical-root selector and document that packaged copies are derived artifacts, not peer truths.
- [Existing workflows may depend on `packages/cli/assets/webui`] → Keep build/publish support, but narrow its role to packaging and update scripts/tests accordingly.
- [Startup becomes stricter] → Emit explicit remediation text such as which build command to run.

## Migration Plan

1. Introduce a canonical WebUI asset-root resolver in CLI startup.
2. Update `agenter web` to serve only that resolved root.
3. Keep `build:assets` only as a derivation step for packaging flows, not as the source used by workspace verification.
4. Add integration/browser coverage that exercises default `agenter web` deep links after a fresh WebUI build.
5. Update durable specs and build docs to reflect the new law.

## Open Questions

- Should packaged/distributed CLI builds embed an asset-root manifest or continue using a fixed derived directory name?
- Do we want `agenter web` to accept an explicit asset-root override flag for release debugging, or should the runtime law remain fully implicit?
