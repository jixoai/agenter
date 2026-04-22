## 1. Mounted system discovery

- [ ] 1.1 Define how `settings.local.json` declares mounted workspace Systems and their token sources.
- [ ] 1.2 Define the lifecycle for creating/updating/destroying mounted System instances as workspaces mount/unmount.

## 2. Attention integration

- [ ] 2.1 Define how mounted Systems publish AttentionContexts and/or AttentionItems through shared adapters.
- [ ] 2.2 Define mute/resume semantics for contexts when a workspace is unmounted and remounted.

## 3. Runtime control

- [ ] 3.1 Define how shell/runtime control can inspect and replan muted mounted-system contexts after remount.
- [ ] 3.2 Re-evaluate whether the shell law should remain `root_bash + workspace_bash` or converge toward a more uniform workspace-first control surface.
