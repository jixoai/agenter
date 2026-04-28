## Why

The runtime skill system already treats watcher events as dirtiness hints and recomputes skill truth from disk, but its fingerprint baseline is only in memory. If skills are added, edited, or removed while the runtime process is stopped, the next startup refreshes the skill snapshot but cannot explain which skills changed as attention debt.

That makes stopped-runtime skill edits silent. We need the skill system to keep a small session-local fingerprint manifest so cold-start refresh can compare current disk truth with the last committed baseline and publish the same aggregated skill-change reminders used by live watcher events.

## What Changes

- Persist the runtime skill fingerprint baseline under the session root, outside all skill watch roots.
- Compare startup/current disk truth against the persisted baseline when reminder publication is enabled.
- Treat a missing or corrupt manifest as baseline initialization/repair, not as a noisy "all skills added" event.
- Keep `SKILL.md + ccski.config.json + declared files[]` as the only skill truth included in the manifest.
- Preserve the existing skill CLI/API shape and attention ingress format.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `runtime-skill-system-surface`: runtime skill refresh must detect stopped-process skill changes through a session-local persisted fingerprint manifest.

## Impact

- Affected code: runtime skill refresh/diff, session runtime skill-system construction, and skill-system tests.
- Affected data: new `sessionRoot/skill-system/fingerprint-map.json` runtime-private manifest.
- Affected APIs: no public CLI/API shape changes.
- Affected tests: runtime skill BDD tests and session runtime attention integration coverage.
