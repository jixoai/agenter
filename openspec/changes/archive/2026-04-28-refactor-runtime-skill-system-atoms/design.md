## Design

The skill system remains a single public facade, but its internal physics are split into atoms:

- catalog: discovers built-in/shared/global/avatar skills and applies same-name override.
- truth snapshot: reads config, resolves observed files, and builds fingerprint state.
- diff engine: compares two snapshots keyed only by `skill.name`.
- baseline store: reads/writes the session-local fingerprint manifest.
- watch service: converts filesystem/poll events into dirtiness hints only.
- publisher: converts snapshots and skill diffs into runtime system ingress.

The manifest stays a baseline, not skill truth. Missing or invalid manifests initialize/repair baseline without noisy reminders. Watchers still do not decide semantic changes; every flush rebuilds truth from disk and diffs snapshots.

The public identity law is unchanged: `skill.name` is the key. If two roots expose the same skill name, the later visible skill overrides the earlier one. Avoiding accidental override remains a naming convention problem, for example using a longer skill name such as `built-in/message-system`.
