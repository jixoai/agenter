## Why

The exported performance trace at `/Users/kzf/Downloads/Trace-20260319T224942.json.gz` shows sustained CPU pressure on the renderer main thread, with React profiling markers pointing at repeated WebUI re-renders driven by unstable callback and child identities. This needs to be fixed now because the current shell, Chat, and Devtools surfaces already stream live runtime updates, so wasted render work compounds as sessions stay open in the background.

## What Changes

- Analyze the exported browser performance trace and turn the observed renderer hotspots into an explicit WebUI performance change instead of relying on anecdotal CPU complaints.
- Stabilize high-frequency shell, navigation, and tab callbacks so workspace chrome does not re-render large button, tooltip, and navigation trees on every unrelated runtime update.
- Add an explicit performance guard for Chat and Devtools route surfaces so long-history chat recovery and technical panels remain responsive while live session data continues to stream.
- Extend WebUI verification with targeted regression checks for restored chat history, Devtools scroll ownership, and render-contract hotspots that were identified in the trace.

## Capabilities

### New Capabilities
- `webui-render-performance-guard`: Define the profiling-backed contract for reducing avoidable React re-render churn in workspace shell chrome, Chat restoration, and Devtools inspection surfaces.

### Modified Capabilities
- `chat-surface-presentation`: Tighten the restored long-history Chat behavior so the route remains focused on the latest visible conversation turn without extra render churn.
- `workspace-devtools-surface`: Tighten Devtools route behavior so technical panels keep fixed chrome and one deliberate content viewport while avoiding unnecessary shell-level updates.
- `overflow-layout-contract`: Extend the layout contract so async/panel wrappers keep explicit clipping and scroll ownership without reopening render-heavy layout regressions.

## Impact

- Affected code: `packages/webui/src/features/shell/*`, `packages/webui/src/features/chat/*`, `packages/webui/src/features/process/*`, `packages/webui/src/features/model/*`, `packages/webui/src/features/loopbus/*`, `packages/webui/src/components/ui/*`, and targeted WebUI tests.
- Affected systems: browser renderer performance, runtime-driven React updates, Storybook DOM regression coverage, and Playwright browser walkthrough coverage.
- Evidence source: `/Users/kzf/Downloads/Trace-20260319T224942.json.gz`.
