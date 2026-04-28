## Design

The durable skill truth remains on-disk skill files. The new manifest is not another skill source; it is a session-local baseline for deciding whether current disk truth differs from the last runtime-observed truth.

The manifest lives at `sessionRoot/skill-system/fingerprint-map.json`. This keeps it outside `~/.agents/skills`, `~/.agenter/skills`, `<rootWorkspace>/skills`, and package-owned built-in skill directories, so writing the baseline cannot trigger a skill watcher or become skill content.

The manifest records:

- manifest version
- generated timestamp
- visible skill identity fields used by existing diff logic
- content fingerprints for observed files

Observed files stay exactly aligned with the existing skill watcher law: `SKILL.md`, existing sibling `ccski.config.json`, and config-declared files. Undeclared sibling churn stays invisible.

Refresh behavior:

- If no manifest path is configured, keep existing in-memory diff behavior.
- If a manifest exists and reminders are enabled, diff current tracked skills against the manifest.
- If the manifest is missing or invalid, write the current tracked state as the baseline and emit no reminders.
- Every successful refresh writes the current tracked state back to the manifest, including explicit `skill refresh`.

This is a platform-law upgrade rather than a watcher patch: watcher and polling still only mark dirtiness; the persisted manifest supplies a cold-start baseline when no watcher existed.
