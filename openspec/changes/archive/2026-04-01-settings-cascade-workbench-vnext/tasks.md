## 1. Settings cascade graph core

- [x] 1.1 Add settings graph model types (layers, provenance chain, jump target, schema payload) in `@agenter/settings`.
- [x] 1.2 Upgrade `loadSettings` merge pipeline to collect field-level provenance for file layers.
- [x] 1.3 Append derived provenance nodes for path/provider/active-provider transforms and export zod JSON schema.
- [x] 1.4 Add/upgrade unit tests for provenance chains and schema payload generation.

## 2. App-server + client contract unification

- [x] 2.1 Add scope-based settings graph endpoints (`workspace|global`) with a shared response contract.
- [x] 2.2 Keep legacy settings endpoints operational while wiring them to the new graph internals.
- [x] 2.3 Extend client-sdk runtime store and exported types to consume the scope-based settings graph APIs.
- [x] 2.4 Add app-server tests covering workspace/global graph list/read/save and readonly/conflict semantics.

## 3. WebUI settings workbench

- [x] 3.1 Build schema-driven `View` renderer (core types + fallback) and pointer patch utilities.
- [x] 3.2 Upgrade workspace Settings panel: Effective `Source/View`, LayerSource top list + bottom `Source/View`, bi-directional sync.
- [x] 3.3 Implement effective provenance jump to layer `View` focus (desktop split + compact sheet).
- [x] 3.4 Replace global user settings JSON editor with the same workbench architecture while preserving avatar catalog tab.

## 4. Verification and walkthrough

- [x] 4.1 Update Storybook stories + DOM contract tests for workspace and global settings surfaces.
- [x] 4.2 Run targeted tests (`@agenter/settings`, app-server workspace/global settings tests, webui unit + dom).
- [x] 4.3 Execute `agent-browser` desktop/mobile walkthrough for workspace and global settings source/view flows, and record evidence.
