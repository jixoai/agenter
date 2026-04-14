## 1. OpenSpec and platform setup

- [x] 1.1 Record the structured-value-preview spec change for the Svelte + CodeMirror viewer migration.
- [x] 1.2 Add the WebUI dependencies needed for JSON/YAML CodeMirror rendering and YAML serialization.

## 2. Structured viewer implementation

- [x] 2.1 Replace the current Lit-backed `json-viewer.svelte` wrapper with a WebUI-native Svelte structured viewer.
- [x] 2.2 Preserve local/global mode selection, YAML-first defaults, and mergeable caller-owned framing classes.
- [x] 2.3 Update existing runtime and tool payload surfaces to keep rendering through the migrated viewer contract.

## 3. Verification

- [x] 3.1 Add regression coverage for the structured viewer's mode logic and Storybook DOM behavior.
- [x] 3.2 Run WebUI typecheck and targeted tests for the new viewer.
- [x] 3.3 Verify the upgraded viewer in the running browser workbench and commit the change.
